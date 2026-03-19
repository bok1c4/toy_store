# 🧸 Toy Store

> **Jezik** · [English](./README.md) · [Srpski (Serbian)](./README.sr.md)

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Web aplikacija za prodaju igračaka izgrađena kao full-stack projekat sa Go backend API-jem, Next.js 14 frontendом, PostgreSQL bazom podataka i Redis kešom — sve orkestrirano kroz Docker Compose i serviovano iza Nginx reverse proxy-ja.

---

## 📋 Pregled sistema (Overview)

Toy Store je e-commerce platforma koja korisnicima omogućava da pregledaju katalog igračaka, dodaju ih u korpu ili listu želja i završe kupovinu. Registrovani korisnici imaju uvid u istoriju svih svojih porudžbina i mogu zatražiti otkazivanje aktivnih porudžbina. Administratori imaju poseban panel sa pregledom svih porudžbina, korisnika, analitičkim podacima i mogućnošću odobravanja ili odbijanja zahteva za otkazivanje.

Važna arhitekturna odluka tiče se podataka o igračkama: aplikacija **ne čuva igračke u sopstvenoj bazi**. Katalog se preuzima sa eksternog API-ja (`toy.pequla.com/api`) i kešira u Redis-u. Frontend nikad ne poziva eksterni API direktno — svi zahtevi prolaze kroz Go backend, koji je jedina tačka integracije sa spoljnim sistemom. Ovo omogućava centralizovano upravljanje greškama, keširanje i bezbednost.

Plaćanje je implementirano kroz Stripe test mode — novac se ne skida sa kartice i sve transakcije su simulirane. Kada je Stripe ključ konfigurisan u `.env` i počinje sa `sk_`, sistem koristi pravi Stripe PaymentIntent tok sa klijentskim potvrđivanjem. Kada ključ nije postavljen, sistem automatski prelazi u mock mod i kreira porudžbinu odmah, bez Stripe integracije. Ceo sistem se pokreće jednom komandom (`docker-compose up --build`) i dostupan je na `http://localhost`.

---

## 📸 Screenshots

| Home Page | Katalog igračaka | Admin Dashboard |
|-----------|-----------------|-----------------|
| _screenshot_ | _screenshot_ | _screenshot_ |

> Pokrenite aplikaciju i dodajte screenshots.

---

## 🏗️ Arhitektura sistema

### Dijagram arhitekture

```
Browser / Klijent
       │
       ▼
  Nginx (port 80)
  ├── Rate limiting
  │   ├── auth_limit: 10 req/min, burst=5  (zone: 10MB, po IP adresi)
  │   └── api_limit:  200 req/min, burst=50 (zone: 10MB, po IP adresi)
  │
  ├── location = /health        → Backend (exact match, bez rate limita)
  ├── location /api/health      → rewrite → /health (interni rewrite)
  ├── location /api/auth/       → Backend (auth_limit — strogi limit)
  ├── location /api/            → Backend (api_limit — opšti limit)
  └── location /                → Frontend (Next.js, WebSocket upgrade)
       │
  ┌────┴────────────────────────────────────────┐
  │                                             │
  ▼                                             ▼
Backend (Go/Gin)                         Frontend (Next.js 14)
port 8080                                port 3000
  │
  ├── PostgreSQL (port 5432)
  │   ├── users
  │   ├── orders + order_items
  │   ├── cart_items
  │   └── wishlist_items
  │
  ├── Redis (port 6379)
  │   ├── JWT refresh tokens (TTL: 168h)
  │   ├── toys:all (TTL: 5 min)
  │   ├── toy:<id> (TTL: 5 min)
  │   ├── toys:filtered:<ag>:<type>:<q> (TTL: 5 min)
  │   ├── age-groups (TTL: 30 min)
  │   └── toy-types  (TTL: 30 min)
  │
  └── toy.pequla.com (eksterni API)
      GET /api/toy
      GET /api/toy/:id
      GET /api/toy/permalink/:slug
      GET /api/age-group
      GET /api/type
```

### Objašnjenje svake komponente

#### Nginx (Reverse Proxy)

Nginx stoji ispred celog sistema kao jedina javna tačka ulaza. Ovo nam daje nekoliko prednosti: korisnici nikad ne komuniciraju direktno sa Go procesom ili Next.js serverom, sav saobraćaj prolazi kroz jednu tačku koja može da filtrira, loguje i ograničava zahteve.

Rate limiting je konfigurisan na dva nivoa. Za auth rute (`/api/auth/`) primenjen je stroži limit od 10 zahteva po minuti sa `burst=5` — ovo direktno sprečava brute-force napade na login endpoint. Burst od 5 dozvoljava korisniku da brzo pokuša nekoliko puta ako pogreši lozinku, ali blokira automatizovane napade. Za ostale API rute važi liberalniji limit od 200 zahteva po minuti sa `burst=50`, što je sasvim dovoljno za legitimne korisnike.

`location = /health` koristi exact match (`=`) iz razloga redosleda evaluacije: Nginx proverava lokacije od najtačnijih ka opštijima, pa se health check ruta nikad ne uhvati u opšti `/api/` blok sa rate limitom. Ovo je važno jer Docker Compose šalje health check svakih 10 sekundi.

Rate limiting se primenjuje na Nginx nivou, **pre nego što zahtev uopšte stigne do Go procesa** — napadač koji generiše hiljade zahteva troši samo Nginx resurse, a Go backend prima samo legitiman saobraćaj.

Stripe webhook endpoint (`/api/webhook/stripe`) nema poseban rate limit — namerno. Stripe garantuje pouzdanu isporuku webhook-ova i server mora biti u stanju da ih prihvati bez ograničenja, jer svaki propušteni webhook znači propuštenu informaciju o statusu plaćanja.

#### Backend (Go + Gin)

Koristimo Go 1.23 sa Gin HTTP frameworkom. Go smo izabrali zbog statičkog tipiziranja koje eliminiše čitavu klasu runtime grešaka, kompajliranog binarnog fajla bez runtime zavisnosti i odlične podrške za konkurentno programiranje. Gin dodaje routing, middleware chaining i JSON binding uz minimalan overhead.

Backend je organizovan po strogoj troslojenoj arhitekturi:

```
HTTP zahtev → Handler → Service → Repository → Database
```

**Handler** sloj (`internal/handlers/`) jedini sme da dodiruje HTTP kontekst: čita parametre iz URL-a, deserijalizuje JSON telo, poziva servis i vraća JSON odgovor sa odgovarajućim HTTP statusom. Handler nikad ne sme da sadrži poslovnu logiku.

**Service** sloj (`internal/services/`) sadrži svu poslovnu logiku. Funkcije vraćaju `error` vrednosti, nikad HTTP statuse — ta odluka pripada handleru. Service može pozvati više repozitorijuma i koordinirati između njih.

**Repository** sloj (`internal/repository/`) sadrži isključivo SQL upite. Ne zna ništa o HTTP-u ni o poslovnim pravilima — samo izvršava upite i mapira rezultate u modele.

Ovo razdvajanje nije formalizam — direktno poboljšava testabilnost (svaki sloj se može testirati izolovano uz mock zavisnosti), maintainability (promena baze podataka zahteva izmene samo u repository sloju) i čitljivost koda.

Database migracije se izvršavaju automatski pri svakom pokretanju backenda koristeći `golang-migrate`. Migracije su numerisani SQL fajlovi (`000001_create_users.up.sql`, `000002_create_orders.up.sql`, itd.) koji se izvršavaju strogo u redosledu i nikad dvaput. Stanje migracija se čuva u `schema_migrations` tabeli u PostgreSQL-u. Ovo garantuje da baza uvek bude u konzistentnom, poznatom stanju bez ručnih intervencija.

Strukturirano logovanje je implementirano kroz `zerolog` koji piše JSON linije na standardni izlaz — svaki log event je mašinski čitljiv sa strukturiranim poljima poput `user_id`, `latency`, `status` i `path`. To čini logove pretražljivim i analizabilnim u produkciji alatima poput Loki-ja ili Elasticsearch-a.

#### Frontend (Next.js 14 App Router)

Next.js 14 sa App Router-om koristimo iz nekoliko razloga. Server-side rendering poboljšava SEO jer pretraživači dobijaju potpuno renderovan HTML, a ne praznu `<div id="root">` stranicu. File-based routing smanjuje konfiguraciju. React Server Components omogućavaju data fetching na serveru — home page preuzima katalog igračaka direktno od backend-a unutar Docker mreže (`http://backend:8080`) bez toga da taj zahtev prolazi kroz browser korisnika, čime se eliminiše waterfall i smanjuje latencija.

Client Components (`'use client'`) koristimo samo tamo gde je neophodno — za interaktivne elemente kao što su korpa, forma za prijavu i lista želja. Ostatak aplikacije su Server Components koji se renderuju na serveru i šalju gotov HTML.

Axios interceptor (`lib/api.ts`) automatski dodaje JWT access token na svaki zahtev iz browser-a. Tokeni se čuvaju u **localStorage** za pristup iz Axios interceptora, a paralelno se upisuju u **cookies** za pristup iz Next.js middleware-a. Oba skladišta se sinhronizuju pri svakoj promeni auth stanja.

Kada token istekne i backend vrati 401, interceptor transparentno poziva refresh endpoint, dobija novi par tokena i ponavlja originalni zahtev — korisnik ovo ne primećuje. Ključna bezbednosna detalj: interceptor **ne redirectuje na `/login`** ako korisnik nije ulogovan (nema refresh token) — samo odbija zahtev. Redirect na login se dešava jedino kada je korisnik bio ulogovan ali mu je sesija istekla.

Pored Axios interceptora, sistem koristi **CustomEvent** (`auth-state-change`) za sinhronizaciju auth stanja između komponenti i browser tabova — `AuthProvider` dispatchuje event pri login/logout/refresh, a sve komponente koje naslušaju ovaj event osvežavaju svoje lokalno stanje.

Zustand koristimo za client-side state management korpe i liste želja. Izabrali smo ga zbog minimalnog API-ja bez boilerplate-a koji je tipičan za Redux — čitav store se definiše u jednoj funkciji.

  Tamni i svetli mod su implementirani kroz `next-themes` biblioteku. `ThemeProvider` (`src/components/providers/ThemeProvider.tsx`) se koristi sa `attribute="class"` što dodaje ili uklanja `class="dark"` na `<html>` element. Tailwind-ov `darkMode: ["class"]` mode automatski primenjuje sve `dark:` varijante klasa. Podrazumevano, aplikacija prati sistemsku preferencu korisnika (`prefers-color-scheme`).

  Koristi se **Tailwind CSS custom properties** za sve boje u aplikaciji — nikad hardkodirane `bg-white`, `bg-gray-50`, `text-gray-700` i slično. CSS varijable u `globals.css` definišu semantic tokens (`--background`, `--foreground`, `--card`, `--muted`, `--border`, `--input`, `--primary`, `--destructive`, itd.) koje se koriste kao Tailwind klase (`bg-background`, `text-foreground`, `border-border`). Brand boje (`--brand-primary`, `--brand-sage`) su definisane u `tailwind.config.js`. Ovaj pristup garantuje konzistentan izgled u light i dark modu bez potrebe za dual styling-om.

#### PostgreSQL

Izabrali smo PostgreSQL 16 zbog ACID garancija — svaka transakcija je atomična, konzistentna, izolovana i trajna. To je ključno za operacije narudžbine gde se u jednoj transakciji kreira porudžbina, upisuju stavke i briše korpa.

Primary ključevi su UUID-ovi umesto sekvencijalnih integera. Razlog je bezbednost: sekvencijalni ID (`/orders/1`, `/orders/2`) omogućava napadaču da enumeracijom proba sve porudžbine. UUID formata `a1b2c3d4-e5f6-7890-abcd-ef1234567890` je nepredvidiv i ne može se pogoditi bez pristupa bazi.

Tabela `order_items` čuva `toy_name` i `price_at_purchase` kao snapshot u trenutku kupovine. Ovo je arhitekturna odluka direktno vezana za upotrebu eksternog API-ja koji mi ne kontrolišemo: cene mogu da porastu, igračke mogu biti uklonjene iz kataloga. Bez snapshot-a, istorija porudžbina bi bila nekonzistentna — prikazivala bi aktuelne cene umesto onih koje je korisnik zaista platio, ili bi pucala za igračke koje više ne postoje u eksternom sistemu.

#### Redis

Redis ima dve potpuno odvojene uloge u sistemu. Prva je čuvanje JWT refresh tokena: backend upisuje refresh token u Redis pri prijavi i briše ga pri odjavi ili refresh-u. Ovo rešava fundamentalni problem JWT autentifikacije — JWT tokeni su po prirodi nerevokabilni dok ne isteknu. Sa Redis-om, odjava zaista funkcioniše jer backend proverava postojanje refresh tokena u Redis-u pri svakom refresh zahtevu. Bez Redis-a, korisnik bi i nakon odjave mogao koristiti ukradeni access token sve dok ne istekne (15 minuta).

Druga uloga je keširanje kataloga igračaka. Kad god dođe zahtev za igračke, servis prvo proverava Redis. Na cache hit, podaci se vraćaju odmah bez HTTP poziva eksternom API-ju. Na cache miss, podaci se preuzimaju sa `toy.pequla.com`, upisuju u Redis sa TTL-om i vraćaju korisniku. TTL je 5 minuta za katalog i pojedinačne igračke, 30 minuta za kategorije i tipove koji se retko menjaju.

Ako Redis nije dostupan, `redis.Set()` vraća grešku koja se loguje kao upozorenje (`log.Warn()`), ali zahtev nastavlja normalno — sistem degradira gracefully na direktne API pozive bez keša.

#### Eksterni API (toy.pequla.com)

Aplikacija ne poseduje podatke o igračkama — sav katalog dolazi sa `https://toy.pequla.com/api`. Backend je jedini koji poziva ovaj API, iz tri razloga. Bezbednost: frontend koji direktno poziva eksterni API bi izložio tu zavisnost korisnicima. Keširanje: centralizovanjem poziva u backend, keš u Redis-u važi za sve korisnike, ne samo za jednog. Error handling: sve greške eksternog API-ja se hvataju i transformišu na jednom mestu u konzistentne poruke greške koje korisnik vidi.

`ToyService` ima `httpClient` sa timeoutom od 10 sekundi — ako eksterni API ne odgovori, zahtev ne blokira goroutine zauvek.

---

## 🗄️ Baza podataka — Schema

### Tabela `users`

Čuva sve registrovane korisnike sistema.

| Kolona | Tip | Opis |
|--------|-----|------|
| `id` | `UUID` PRIMARY KEY | Auto-generisan UUID (`uuid_generate_v4()`) |
| `username` | `VARCHAR(50)` NOT NULL UNIQUE | Korisničko ime, jedinstveno u sistemu |
| `email` | `VARCHAR(255)` NOT NULL UNIQUE | Email adresa, koristi se za prijavu |
| `password_hash` | `VARCHAR(255)` NOT NULL | bcrypt hash lozinke (cost 12) — nikad plaintext |
| `role` | `VARCHAR(20)` NOT NULL DEFAULT `'user'` | `'user'` ili `'admin'`, CHECK constraint |
| `avatar_url` | `TEXT` nullable | URL slike profila |
| `address` | `TEXT` nullable | Adresa za dostavu |
| `is_active` | `BOOLEAN` NOT NULL DEFAULT `true` | Onemogućen nalog ne može da se prijavi |
| `created_at` | `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()` | Vreme registracije |
| `updated_at` | `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()` | Vreme poslednje izmene |

Indeksi: `idx_users_email`, `idx_users_username` — ubrzavaju lookup pri prijavi i proveri jedinstvenosti.

### Tabela `orders`

Svaka završena kupovina generiše jedan red u ovoj tabeli.

| Kolona | Tip | Opis |
|--------|-----|------|
| `id` | `UUID` PRIMARY KEY | Auto-generisan UUID |
| `user_id` | `UUID` NOT NULL | FK → `users(id)` ON DELETE CASCADE |
| `status` | `VARCHAR(30)` NOT NULL DEFAULT `'pending'` | `pending`, `processing`, `shipped`, `delivered`, `cancelled` |
| `payment_status` | `VARCHAR(20)` NOT NULL DEFAULT `'pending'` | `pending`, `paid`, `failed`, `refunded` |
| `total_amount` | `NUMERIC(10,2)` NOT NULL | Ukupan iznos u RSD (u najmanjoj jedinici — bez decimala, npr. 4999 = 49,99 RSD) |
| `shipping_address` | `TEXT` NOT NULL | Adresa dostave u trenutku kupovine |
| `cancellation_requested` | `BOOLEAN` NOT NULL DEFAULT `false` | Korisnik je zatražio otkazivanje |
| `cancellation_reason` | `TEXT` nullable | Razlog koji je korisnik naveo |
| `cancellation_approved` | `BOOLEAN` nullable | `true`/`false` kada admin odluči, `NULL` dok čeka |
| `cancellation_response` | `TEXT` nullable | Admin komentar uz odluku |
| `created_at` | `TIMESTAMPTZ` NOT NULL | Vreme kreiranja porudžbine |
| `updated_at` | `TIMESTAMPTZ` NOT NULL | Poslednja izmena statusa |

Indeksi: `idx_orders_user_id`, `idx_orders_created_at DESC` — ubrzavaju listanje porudžbina po korisniku i sortiranje po datumu.

### Tabela `order_items`

Stavke svake porudžbine. Ovo je ključna tabela za razumevanje arhitekturne odluke o snapshot-u podataka.

| Kolona | Tip | Opis |
|--------|-----|------|
| `id` | `UUID` PRIMARY KEY | Auto-generisan UUID |
| `order_id` | `UUID` NOT NULL | FK → `orders(id)` ON DELETE CASCADE |
| `toy_id` | `INTEGER` NOT NULL | ID igračke iz eksternog API-ja (nema FK — eksterni sistem) |
| `toy_name` | `VARCHAR(255)` NOT NULL | **Snapshot** — ime igračke u trenutku kupovine |
| `toy_image_url` | `TEXT` nullable | **Snapshot** — URL slike u trenutku kupovine |
| `price_at_purchase` | `NUMERIC(10,2)` NOT NULL | **Snapshot** — cena u trenutku kupovine (u najmanjoj jedinici) |
| `quantity` | `INTEGER` NOT NULL CHECK `> 0` | Naručena količina |

Zašto snapshot? Igračke dolaze iz eksternog API-ja koji mi ne kontrolišemo. Ako eksterni sistem promeni cenu igračke ili je potpuno ukloni iz kataloga, porudžbine koje su već plaćene moraju da prikažu tačne podatke iz trenutka kupovine. `toy_id` je `INTEGER` bez FK constraint-a jer ne možemo garantovati referencijalni integritet prema eksternom sistemu.

### Tabela `cart_items`

Predstavlja aktivnu korpu svakog korisnika. Korpa nije porudžbina — briše se po završetku narudžbine u DB transakciji.

| Kolona | Tip | Opis |
|--------|-----|------|
| `id` | `UUID` PRIMARY KEY | Auto-generisan UUID |
| `user_id` | `UUID` NOT NULL | FK → `users(id)` ON DELETE CASCADE |
| `toy_id` | `INTEGER` NOT NULL | ID igračke iz eksternog API-ja |
| `toy_name_cache` | `VARCHAR(255)` NOT NULL | Keširano ime za brži prikaz korpe |
| `toy_image_cache` | `TEXT` nullable | Keširana URL slike |
| `price_cache` | `NUMERIC(10,2)` NOT NULL | Keširana cena u najmanjoj jedinici u trenutku dodavanja |
| `quantity` | `INTEGER` NOT NULL DEFAULT `1` CHECK `> 0` | Količina u korpi |
| `updated_at` | `TIMESTAMPTZ` NOT NULL | Poslednja izmena |
| UNIQUE(`user_id`, `toy_id`) | | Korisnik ne može dva puta dodati istu igračku — samo menja količinu |

### Tabela `wishlist_items`

Jednostavna tabela veza između korisnika i igračaka koje žele sačuvati za kasniji pregled.

| Kolona | Tip | Opis |
|--------|-----|------|
| `id` | `UUID` PRIMARY KEY | Auto-generisan UUID |
| `user_id` | `UUID` NOT NULL | FK → `users(id)` ON DELETE CASCADE |
| `toy_id` | `INTEGER` NOT NULL | ID igračke iz eksternog API-ja |
| `created_at` | `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()` | Kada je dodato |
| UNIQUE(`user_id`, `toy_id`) | | Svaka igračka može biti u listi želja samo jednom po korisniku |

### Relacije između tabela

```
users (1) ──────────── (N) orders
users (1) ──────────── (N) cart_items
users (1) ──────────── (N) wishlist_items
orders (1) ─────────── (N) order_items
```

Sve FK veze imaju `ON DELETE CASCADE` — brisanje korisnika automatski briše sve njegove porudžbine, stavke porudžbina, korpu i listu želja. Ovo sprečava orphan records u bazi i osigurava konzistentnost podataka bez ručnog čišćenja.

---

## 🔐 Autentifikacija i bezbednost

### JWT strategija — dual-token sistem

Koristimo dva tokena: kratkotrajan access token i dugotrajan refresh token. Ovo je standardni obrazac koji balansira bezbednost i korisničko iskustvo.

**Access token** traje 15 minuta (konfigurabilno kroz `JWT_ACCESS_TTL`). Šalje se u `Authorization: Bearer <token>` header pri svakom zahtevu koji zahteva autentifikaciju. Kratko trajanje ograničava štetu ako token bude ukraden — napadač ga može koristiti samo 15 minuta.

**Refresh token** traje 168 sati / 7 dana (konfigurabilno kroz `JWT_REFRESH_TTL`) i čuva se u Redis-u. Koristi se isključivo za obnavljanje para tokena. Korisnik ga ne šalje na svaki zahtev, već samo kada access token istekne.

Tok obnavljanja tokena:

```
1. Korisnik šalje zahtev → backend vraća 401 (access token istekao)
2. Axios interceptor automatski šalje POST /api/auth/refresh
   sa refresh tokenom
3. Backend proverava Redis: postoji li ovaj refresh token?
4. Ako DA → generiše novi access + refresh par, briše stari refresh
   iz Redis-a (rotation), vraća novi par
5. Ako NE → token je revokiran (korisnik se odjavio ili token istekao),
   vraća 401
6. Axios interceptor ponavlja originalni zahtev sa novim access tokenom
7. Korisnik ništa ne primećuje — transparentno za UX
```

Bez Redis-a, JWT bi bio potpuno nerevokabilan — nemoguće bi bilo implementirati odjavu koja zaista funkcioniše, jer bi ukradeni access token bio validan do isteka.

### Zaštita lozinki

Lozinke se hešuju koristeći `bcrypt` sa cost faktorom 12. Cost faktor 12 znači da algoritam izvodi 2¹² = 4096 rundi heširanja, što jedan pokušaj heširanja čini sporim (oko 200-400ms na savremenom hardveru). Napadač koji pokušava brute-force napad može testirati samo nekoliko hiljada lozinki u sekundi — umesto milijardi koliko bi bilo moguće sa MD5 ili SHA-256.

bcrypt automatski generiše i embeds nasumičan salt u svaki hash, što znači da isti plaintext daje različit hash pri svakom pozivu. Ovo eliminiše efikasnost rainbow table napada — napadač ne može unapred izračunati hash tabelu.

Lozinka se nikad ne loguje, nikad ne vraća u API odgovoru i nikad ne čuva u plaintext obliku — ni u bazi, ni u Redis-u, ni u logovima.

### Role-based access control (RBAC)

Sistem ima dva nivoa pristupa: `user` i `admin`. Role se čuvaju u JWT claims-ima i proveravaju se u middleware-u pri svakom zahtevu.

Middleware lanac za admin rute:

```
HTTP zahtev
     │
     ▼
RequireAuth()          ← proverava JWT potpis i rok trajanja,
     │                    validira token type == "access",
     │                    upisuje userID i role u Gin context
     ▼
RequireAdmin()         ← čita role iz Gin context-a,
     │                    vraća 403 Forbidden ako role != "admin"
     ▼
Handler
```

`RequireAdmin` je primenjen na nivou **route grupe** u `router.go`, a ne na svakom handleru posebno:

```go
adminGroup := r.Group("/api/admin")
adminGroup.Use(authMiddleware.RequireAuth())
adminGroup.Use(authMiddleware.RequireAdmin())
{
    adminGroup.GET("/users", ...)
    adminGroup.GET("/orders", ...)
    // svaki novi endpoint automatski dobija oba middleware-a
}
```

Ovo je security by default — programer koji doda novi admin endpoint ne mora da pamti da doda zaštitu. Ona je već primenjena na nivou grupe.

### Rate limiting

Rate limiting je implementiran na Nginx nivou, a ne u aplikacionom kodu. Postoje dve zone:

- `auth_limit` (10 req/min, burst=5, zone 10MB): primenjuje se na `/api/auth/`. Dizajniran da zaustavi brute-force napade na login.
- `api_limit` (200 req/min, burst=50, zone 10MB): primenjuje se na ostale `/api/` rute. Dovoljan za legitimne korisnike, ali ograničava automatizovane skrejpere i DoS napade.

Prednost Nginx nivoa u odnosu na aplikacioni nivo: Nginx blokira zahtev pre nego što Go proces alocira goroutinu i parsira telo zahteva. Napadač koji generiše 10.000 zahteva u sekundi troši samo Nginx resurse — minimalne u poređenju sa Go runtime-om.

### Validacija inputa

Validacija se odvija na oba sloja sistema bez izuzetka.

Na **backend-u**, sve request strukture imaju `validate` struct tagove koji se evaluiraju pomoću `go-playground/validator/v10`:

```go
type RegisterRequest struct {
    Username string `json:"username" validate:"required,min=3,max=50"`
    Email    string `json:"email"    validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
}
```

Na **frontend-u**, sve forme se validiraju Zod schemom pre slanja API zahteva. Greške validacije se prikazuju inline pored polja sa porukama na srpskom jeziku.

Svi SQL upiti koriste parametrizovane argumente — nikad string konkatenaciju. Ovo je apsolutna zaštita od SQL injection napada:

```go
// Ispravno — parametrizovano
row := db.QueryRow(ctx,
    "SELECT id, email FROM users WHERE email = $1", email)

// Pogrešno — nikad ovako
query := "SELECT * FROM users WHERE email = '" + email + "'"
```

---

## 📡 API dokumentacija

### Pregled svih endpointa

| Method | Endpoint | Auth | Opis |
|--------|----------|------|------|
| `POST` | `/api/auth/register` | ❌ | Registracija novog korisnika |
| `POST` | `/api/auth/login` | ❌ | Prijava, vraća JWT par |
| `POST` | `/api/auth/logout` | ✅ | Odjava, revokacija refresh tokena u Redis-u |
| `POST` | `/api/auth/refresh` | ❌ | Obnavljanje access tokena refresh tokenom |
| `GET` | `/api/user/profile` | ✅ | Profil ulogovanog korisnika |
| `PUT` | `/api/user/profile` | ✅ | Izmena username-a, adrese i avatara |
| `PUT` | `/api/user/password` | ✅ | Promena lozinke (zahteva staru lozinku) |
| `GET` | `/api/user/orders` | ✅ | Paginisana istorija porudžbina |
| `GET` | `/api/user/orders/:id` | ✅ | Detalji jedne porudžbine sa stavkama |
| `POST` | `/api/user/orders/:id/cancel` | ✅ | Zahtev za otkazivanje porudžbine |
| `GET` | `/api/toys` | ❌ | Lista igračaka (filter: `type`, `age_group`, `q`, `page`, `per_page`) |
| `GET` | `/api/toys/:id` | ❌ | Detalji igračke po numeričkom ID-ju |
| `GET` | `/api/toys/permalink/:slug` | ❌ | Igračka po URL permalinku |
| `GET` | `/api/toys/age-groups` | ❌ | Lista uzrasnih grupa |
| `GET` | `/api/toys/types` | ❌ | Lista tipova igračaka |
| `GET` | `/api/cart` | ✅ | Korpa korisnika sa izračunatim subtotal-om |
| `POST` | `/api/cart` | ✅ | Dodaj igračku u korpu (`toy_id`, `quantity`) |
| `PUT` | `/api/cart/:item_id` | ✅ | Izmeni količinu stavke u korpi |
| `DELETE` | `/api/cart/:item_id` | ✅ | Ukloni stavku iz korpe |
| `DELETE` | `/api/cart` | ✅ | Isprazni celu korpu |
| `GET` | `/api/wishlist` | ✅ | Lista želja sa detaljima igračaka |
| `POST` | `/api/wishlist` | ✅ | Dodaj igračku u listu želja |
| `DELETE` | `/api/wishlist/:toy_id` | ✅ | Ukloni igračku iz liste želja |
| `GET` | `/api/wishlist/check/:toy_id` | ✅ | Proveri da li je igračka u listi želja |
| `POST` | `/api/checkout` | ✅ | Direktan checkout (mock mode) |
| `POST` | `/api/checkout/intent` | ✅ | Kreira Stripe PaymentIntent, vraća `client_secret` |
| `POST` | `/api/checkout/confirm` | ✅ | Potvrdi Stripe plaćanje i kreira porudžbinu |
| `GET` | `/api/checkout/simulate` | ✅ | Simuliraj plaćanje (test endpoint) |
| `POST` | `/api/webhook/stripe` | ❌* | Stripe webhook za asinhrone statusе plaćanja |
| `GET` | `/api/admin/users` | 👑 | Lista svih korisnika (admin) |
| `GET` | `/api/admin/users/:id` | 👑 | Detalji korisnika (admin) |
| `PUT` | `/api/admin/users/:id` | 👑 | Izmena korisnika — aktivacija/deaktivacija (admin) |
| `GET` | `/api/admin/orders` | 👑 | Sve porudžbine sa filterima (admin) |
| `PUT` | `/api/admin/orders/:id` | 👑 | Izmena statusa porudžbine (admin) |
| `GET` | `/api/admin/analytics` | 👑 | Analitički podaci — prihodi, porudžbine, korisnici (admin) |
| `GET` | `/api/admin/cancellation-requests` | 👑 | Zahtevi za otkazivanje na čekanju (admin) |
| `PUT` | `/api/admin/cancellation-requests/:id/approve` | 👑 | Odobri otkazivanje porudžbine (admin) |
| `PUT` | `/api/admin/cancellation-requests/:id/decline` | 👑 | Odbij zahtev za otkazivanje (admin) |
| `GET` | `/health` | ❌ | Health check — Docker healthcheck i monitoring |

**Legenda:** ❌ javno, ✅ JWT access token required, 👑 admin JWT required
*Stripe webhook nema JWT, ali verifikuje `Stripe-Signature` header koristeći HMAC-SHA256 sa webhook secret-om

### Primeri zahteva i odgovora

```bash
# Registracija novog korisnika
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"petar_nikolic","email":"petar@example.com","password":"sigurna123"}'

# Prijava
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@toystore.com","password":"user123"}'

# Odgovor pri uspešnoj prijavi
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "user",
      "email": "user@toystore.com",
      "role": "user"
    }
  }
}

# Korišćenje access tokena za zaštićene rute
curl http://localhost/api/user/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Pregled kataloga igračaka sa filterima (javno dostupno)
curl "http://localhost/api/toys?age_group=3-5&per_page=10&page=1"

# Dodavanje igračke u korpu
curl -X POST http://localhost/api/cart \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"toy_id": 6, "quantity": 1}'

# Obnavljanje access tokena
curl -X POST http://localhost/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

---

## 💳 Tok plaćanja (Payment Flow)

Stripe plaćanje je implementirano kao dvostepeni proces koji prati Stripe best practices za server-side potvrđivanje. Detekcija Stripe moda se vrši proverom da li `STRIPE_SECRET_KEY` počinje sa `sk_` — to znači da je validan Stripe ključ (test: `sk_test_...`, live: `sk_live_...`). Sve ostalo (prazno, placeholder) aktivira mock mod.

```
Korisnik klikne "Plati"
        │
        ▼
POST /api/checkout/intent
        │
        ├── STRIPE_SECRET_KEY počinje sa "sk_"?
        │
       YES ──────────────────────────────────────────────────────┐
        │                                                         │
         │   Backend kreira PaymentIntent kod Stripe-a             │
         │   - Iznos = suma korpe × 100 (najmanja jedinica)        │
         │   - Valuta: rsd                                         │
        │   Vraća: { client_secret, payment_intent_id,            │
        │            total_amount }                               │
        │                                                         │
        │   Frontend prima client_secret                          │
        │   Stripe.js prikazuje sigurnu formu za karticu          │
        │   Korisnik unosi karticu (broj kartice nikad             │
        │   ne dolazi do našeg servera)                           │
        │                                                         │
        │   stripe.confirmCardPayment(client_secret)              │
        │   (Stripe verifikuje karticu direktno na Stripe          │
        │    serverima — PCI compliant)                           │
        │                                                         │
        │   POST /api/checkout/confirm                            │
        │   { payment_intent_id, shipping_address }               │
        │   Backend poziva Stripe API:                            │
        │   - Proverava: PI.Status == "succeeded"?                │
        │   - Da → kreira porudžbinu u bazi                       │
        │   - Ne → vraća grešku                                   │
        │                                                         │
        NO ──────────────────────────────────────────────────────┤
        │                                                         │
        │   Mock mode — odmah kreira porudžbinu                   │
        │   Bez Stripe poziva, uvek uspešno                       │
        │                                                         │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
              DB transakcija (atomična):
              1. INSERT INTO orders (status='processing', payment_status='paid')
              2. INSERT INTO order_items sa snapshot podacima za svaku stavku
              3. DELETE FROM cart_items WHERE user_id = ?
              (sve ili ništa — ako bilo šta ne uspe, rollback)
```

Dvostepeni tok (intent → confirm) je bezbedniji od jednokratnog pristupa jer backend nikad ne prima broj kartice. Stripe.js komunicira direktno sa Stripe serverima, a naš backend samo verifikuje konačni rezultat pozivom Stripe API-ja.

> **Napomena:** Ovo je Stripe test mode. Novac se ne skida sa kartice i sve transakcije su simulirane.

```
Test kartica:  4242 4242 4242 4242
Datum isteka:  bilo koji budući datum (npr. 12/28)
CVC:           bilo koja 3 cifre (npr. 123)
```

---

## ⚡ Keširanje

Koristimo **cache-aside** (lazy loading) strategiju — backend ručno upravljа kešom bez automatske invalidacije.

```
GET /api/toys
       │
       ▼
redis.Get("toys:all")
       │
       ├── HIT  ──────────────────────────────► Vrati podatke
       │                                        log: "cache_hit"
       │                                        Latencija: ~1ms
       │
       └── MISS
              │
              log: "cache_miss"
              │
              ▼
       GET https://toy.pequla.com/api/toy
       (HTTP timeout: 10 sekundi)
              │
              ▼
       redis.Set("toys:all", data, 5*time.Minute)
       (greška pri pisanju u Redis = upozorenje, ne fatalna greška)
              │
              ▼
       Vrati podatke korisniku
       Latencija: ~200-500ms (HTTP round-trip do eksternog API-ja)
```

### Redis ključevi i TTL-ovi

| Ključ | TTL | Sadržaj |
|-------|-----|---------|
| `toys:all` | 5 min | Ceo katalog igračaka (nekeširan zahtev) |
| `toy:<id>` | 5 min | Jedna igračka po numeričkom ID-ju |
| `toy:permalink:<slug>` | 5 min | Jedna igračka po URL slug-u |
| `toys:filtered:<ag>:<type>:<q>` | 5 min | Filtrirani rezultati pretrage |
| `age-groups` | 30 min | Lista uzrasnih grupa (retko se menja) |
| `toy-types` | 30 min | Lista tipova igračaka (retko se menja) |

Filtrirana pretraga kešira rezultate posebno po kombinaciji filtera — isti filteri od dva različita korisnika dobiće isti keširani odgovor. Metapodaci imaju duži TTL jer tipovi igračaka i uzrasne grupe se ne menjaju često.

Benefiti keširanje su trojaki: smanjuje broj poziva eksternog API-ja čime se štiti od eventualnih kvota, daje brži odgovor korisnicima jer Redis read (~1ms) je višestruko brži od HTTP poziva (200-500ms), i ako eksterni API privremeno padne — poslednje keširani podaci ostaju dostupni korisniku do TTL isteka.

---

## 🚀 Pokretanje projekta

### Preduslovi

- **Docker Desktop** — jedino što je potrebno. Go, Node.js, PostgreSQL i Redis su svi unutar kontejnera.

### Instalacija i pokretanje

```bash
# 1. Kloniraj repozitorijum
git clone git@github.com:bok1c4/toy_store.git
cd toy_store

# 2. Konfiguriši okruženje
cp .env.example .env

# 3. Generiši sigurne vrednosti i popuni .env
#    JWT_SECRET:
openssl rand -hex 32
#    DB_PASSWORD i REDIS_PASSWORD:
openssl rand -hex 24

# 4. Stripe ključevi (opciono)
#    Bez Stripe ključeva sistem radi u mock modu
#    Sa Stripe ključevima: https://dashboard.stripe.com/test/apikeys

# 5. Pokreni sve servise
docker-compose up --build

# Aplikacija je dostupna na http://localhost
```

### Šta se dešava pri pokretanju

1. Docker Compose pokreće PostgreSQL kontejner i čeka health check (`pg_isready -U toystore_user -d toystore`) — backend neće krenuti dok baza nije potpuno spremna
2. Docker Compose pokreće Redis kontejner zaštićen lozinkom i čeka health check (`redis-cli --pass $REDIS_PASSWORD ping`)
3. Backend kontejner se pokreće — automatski izvršava sve SQL migracije redom (`000001` do `000006`) koristeći `golang-migrate`
4. Migracija `000006_seed_data.up.sql` upisuje test korisnike, porudžbine, korpu i wishlist podatke
5. Backend health check na `GET /health` počinje da vraća `{"status":"ok"}`; Frontend kontejner kreće tek tada (`depends_on: backend: condition: service_healthy`)
6. Next.js build se izvršava unutar kontejnera (TypeScript kompilacija, optimizacija), Next.js server se pokreće na portu 3000
7. Nginx kontejner kreće kao poslednji — jedina javna tačka na portu 80, rutira saobraćaj prema backend-u i frontend-u

Za zaustavljanje:

```bash
docker-compose down        # Zaustavlja kontejnere, čuva podatke
docker-compose down -v     # Zaustavlja + briše volume (reset podataka)
```

### Test nalozi

| Uloga | Email | Lozinka | Napomena |
|-------|-------|---------|---------|
| Admin | `admin@toystore.com` | `admin123` | Pristup `/admin` panelu |
| Korisnik | `user@toystore.com` | `user123` | 5 porudžbina, 3 stavke u korpi, 4 u wishlist-u |

Seed podaci za test korisnika uključuju: 3 isporučene porudžbine, 1 porudžbinu u dostavi i 1 porudžbinu u obradi sa aktivnim zahtevom za otkazivanje.

### Test plaćanje (Stripe test mode)

```
Broj kartice:  4242 4242 4242 4242
Datum isteka:  bilo koji budući datum (npr. 12/28)
CVC:           bilo koja 3 cifre (npr. 123)
```

---

## 🗂️ Struktura projekta

```
toy-store/
├── docker-compose.yml          # Orkestracija svih 5 servisa sa health check-ovima
├── .env.example                # Template sa komentarima za svaku varijablu
├── AGENTS.md                   # Konvencije koda i arhitekturna pravila
│
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf              # Reverse proxy, rate limiting zone, keepalive
│
├── backend/                    # Go API server
│   ├── Dockerfile              # Multi-stage build (builder + minimal runtime)
│   ├── go.mod                  # Go 1.23 zavisnosti
│   ├── main.go                 # Entry point — DB, Redis, migracije, server
│   ├── config/
│   │   └── config.go           # Environment varijable sa fail-fast validacijom
│   ├── migrations/             # Verzionisane SQL migracije (golang-migrate)
│   │   ├── 000001_create_users.up.sql
│   │   ├── 000002_create_orders.up.sql
│   │   ├── 000003_create_cart.up.sql
│   │   ├── 000004_create_wishlist.up.sql
│   │   ├── 000005_add_cancellation_columns.up.sql
│   │   └── 000006_seed_data.up.sql
│   └── internal/
│       ├── auth/               # JWT generisanje, validacija, middleware
│       ├── cache/              # Redis klijent wrapper
│       ├── database/           # PostgreSQL connection pool (pgx/v5)
│       ├── handlers/           # HTTP handleri — jedini sloj koji dodiruje HTTP
│       ├── models/             # Domain modeli i request/response strukture
│       ├── repository/         # Database upiti — jedini sloj koji dodiruje SQL
│       ├── router/             # Gin route registracija i middleware chaining
│       └── services/           # Poslovna logika — jedini sloj sa business rules
│
├── frontend/                   # Next.js 14 App Router aplikacija
│   ├── Dockerfile              # Multi-stage build (deps + builder + runner)
│   ├── package.json
│   ├── tailwind.config.js      # Tailwind sa custom brand tokenima i dark mode
│   └── src/
│       ├── app/                # Next.js App Router stranice
│       │   ├── page.tsx        # Home page (Server Component, fetch na serveru)
│       │   ├── globals.css     # CSS varijable, svetli i tamni mod
│       │   ├── layout.tsx      # Root layout — fontovi, ThemeProvider, Navbar
│       │   ├── toys/           # Katalog (/toys) i detalj (/toys/[id])
│       │   ├── cart/           # Pregled korpe
│       │   ├── checkout/       # Stripe forma za plaćanje
│       │   ├── profile/        # Profil korisnika i istorija porudžbina
│       │   ├── wishlist/       # Lista želja
│       │   ├── (auth)/         # Route group: /login i /register
│       │   └── admin/          # Admin panel (zaštićen Next.js middleware-om)
│       ├── components/
│       │   ├── home/           # HeroSection, CategoryBar, FeaturedToys,
│       │   │                   # AgeGroupSection, TrustBanner
│       │   ├── toys/           # ToyCard, ToyFilters, ToySearch
│       │   ├── layout/         # Navbar sa dark mode toggle-om
│       │   ├── providers/      # AuthProvider, ThemeProvider
│       │   └── ui/             # shadcn/ui primitivi (Button, Badge, Skeleton,
│       │                       # Pagination, ThemeToggle, Sonner Toaster)
│       ├── hooks/              # useAuth, useWishlist, useCart
│       ├── lib/
│       │   ├── api.ts          # Axios instanca sa JWT interceptorom i
│       │   │                   # auto-refresh logikom
│       │   ├── auth.ts         # Token helpers (localStorage + cookies)
│       │   ├── errors.ts       # getErrorMessage, getFieldErrors helpers
│       │   └── validators.ts   # Zod scheme sa srpskim greškama validacije
│       ├── store/              # Zustand stores
│       │   ├── cartStore.ts    # Korpa — fetch, add, update, remove
│       │   ├── wishlistStore.ts # Lista želja
│       │   └── orderStore.ts   # Checkout tok i istorija porudžbina
│       └── middleware.ts       # Next.js server-side route zaštita
│
└── database/
    └── seed.sql                # Test podaci (referentna kopija za razvoj)
```

---

## 🛠️ Tehnički stack — obrazloženje izbora

Svaka tehnološka odluka bila je vođena specifičnim zahtevima projekta.

| Tehnologija | Verzija | Zašto |
|-------------|---------|-------|
| **Go + Gin** | 1.23 | Statičko tipovanje eliminiše runtime greške. Kompajlira se u jedan binarni fajl. Gin router sa middleware chaining-om uz minimalan overhead. |
| **Next.js App Router** | 14 | Server Components za data fetching bez waterfall-a. SSR za SEO. File-based routing. Odlična TypeScript integracija. |
| **PostgreSQL** | 16 | ACID garancije za transakcije narudžbine. UUID podrška. `uuid-ossp` ekstenzija. Production-proven. |
| **Redis** | 7 | Sub-milisekundni read/write. Neophodan za revokabilne JWT tokene. TTL nativno podržan. |
| **Nginx** | latest | Industry standard reverse proxy. Rate limiting pre aplikacionog sloja. Keepalive konekcije (32 po upstream-u). |
| **Docker Compose** | — | Reproduktibilno okruženje. Dependency ordering sa health check-ovima. Jedina komanda za ceo stack. |
| **JWT (golang-jwt/v5)** | v5.3 | Stateless autentifikacija. Standard za REST API. Claims sa user_id, role i jti. |
| **bcrypt (golang.org/x/crypto)** | — | Namerno spor hash algoritam za lozinke. Auto-salt. Cost faktor 12 (2¹² rundi). |
| **zerolog** | v1.32 | Strukturirani JSON logovi sa minimalnom alokacijom. Queryable u produkciji. |
| **golang-migrate** | v4.17 | Verzionisane bidirectionalne migracije. Auto-izvršavanje pri pokretanju. |
| **go-playground/validator** | v10.19 | Struct tag validacija. Bogat set built-in pravila. |
| **pgx/v5** | v5.5 | Nativni PostgreSQL driver za Go. Connection pool. Bolje performanse od `database/sql`. |
| **Zod** | v3.22 | Runtime validacija TypeScript tipova. Schema = validacija + type inference u jednom. |
| **Zustand** | v4.5 | Minimalan state management bez Redux boilerplate-a. |
| **Axios** | v1.6 | HTTP klijent sa interceptor podrškom za JWT auto-refresh. |
| **Stripe** | v76 (test mode) | Industrijski standard za plaćanje. PaymentIntent API. Test kartice za simulaciju. |
| **next-themes** | v0.4 | Tamni/svetli mod sa `class` strategijom. System preference podrška. Bez hydration mismatch-a. |
| **shadcn/ui** | — | UI komponente u kodu projekta — nema npm zavisnosti, potpuna kontrola. Tailwind-based. |
| **Sonner** | — | Toast notifikacije za korisničke povratne informacije (success/error). Koristi se u root layout-u kao `<Toaster />`. |
| **tailwindcss-animate** | — | CSS animacije za komponente (fade-in, slide, skeleton pulse). |
| **tw-animate-css** | — | CSS animacije za shadcn/ui komponente. Automatski uključen sa shadcn setup-om. |
| **Recharts** | v2.12 | Grafici za admin analitiku (React komponente, SVG-based). |

---

## ⚠️ Poznata ograničenja

Ovo je akademski projekat. Neka ograničenja su namerna, neka bi se rešila u produkcijskom sistemu.

**Slike igračaka** su servovane sa `toy.pequla.com` servera. Home page koristi emoji placeholder umesto pravih slika jer su URL-ovi slika relativni putevi koji pokazuju na eksterni server nad kojim nemamo kontrolu.

**Stripe webhook** zahteva Stripe CLI alat za lokalno testiranje jer Stripe ne može da pošalje HTTP zahtev na `localhost`. Endpoint `/api/webhook/stripe` postoji i verifikuje HMAC potpis, ali se ne poziva automatski u lokalnom razvoju. U produkciji bi se podesio pravi webhook URL na Stripe Dashboard-u i `STRIPE_WEBHOOK_SECRET` u `.env`.

**Admin panel — zahtevi za otkazivanje** (`/admin/cancellation-requests`): Backend endpoint-i postoje (`/api/admin/cancellation-requests`, `/approve`, `/decline`) ali admin UI za upravljanje otkazivanjima nije implementiran u frontendu. Korisnici mogu zatražiti otkazivanje iz profila, a admin vidi broj zahteva u analitici, ali nema dedicated stranicu za odobravanje/odbijanje. Ovo je planirana nadogradnja.

**Email notifikacije** nisu implementirane. Sistem ne šalje potvrdu porudžbine, obaveštenje o statusu dostave ni reset lozinke na email.

**Pretraga** je implementirana kao in-memory filtriranje na fetchovanoj listi igračaka. Ovo je funkcionalno ali ne skalira za kataloge sa hiljadama igračaka. Produkcijsko rešenje bi koristilo PostgreSQL full-text search ili Elasticsearch.

**HTTPS** nije konfigurisan. Nginx sluša na portu 80 (HTTP). U produkciji bi se dodao SSL certifikat (Let's Encrypt via Certbot) i redirect sa HTTP na HTTPS u nginx.conf.

**Paginacija kataloga** se izvršava client-side na frontendu jer backend vraća sve igračke iz Redis keša odjednom. Serverska paginacija bi bila efikasnija za veliki katalog.

---

## 💻 Pokretanje za razvoj (bez Dockera)

Za developere koji žele hot-reload van Docker kontejnera. Potrebni su lokalno instalirani PostgreSQL 16 i Redis 7.

```bash
# Backend
cd backend

export DB_URL="postgres://toystore_user:lozinka@localhost:5432/toystore?sslmode=disable"
export REDIS_URL="redis://:redis_lozinka@localhost:6379/0"
export JWT_SECRET="$(openssl rand -hex 32)"
export EXTERNAL_API_URL="https://toy.pequla.com/api"
export ENVIRONMENT="development"
export LOG_LEVEL="debug"

# Izvršavanje migracija
go run -tags 'postgres' \
  github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
  -path ./migrations -database "$DB_URL" up

# Pokretanje servera
go run ./main.go

# Linting i statička analiza
go vet ./...
gofmt -w .
go test ./...
```

```bash
# Frontend (u posebnom terminalu)
cd frontend

# Kreiraj .env.local — OBAVEZNO popuni prave vrednosti
# ⚠️ .env.local u frontend/ dir-u PREOVLAĆUJE docker-compose env vars u režimu razvoja!
# ⚠️ Ažuriraj OBAdirektno i .env.local I .env pri promeni Stripe ključeva!
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EOF

npm install
npm run build
npm run dev
# Dev server dostupan na http://localhost:3000

# Type-check i lint
npx tsc --noEmit
npm run lint
npm run build
```

---

## 🔧 Upravljanje migracijama

### Kako migracije funkcionišu

`golang-migrate` pri svakom pokretanju backend-a proverava tabelu `schema_migrations` u PostgreSQL-u:

```sql
-- Tabela koju golang-migrate automatski kreira i održava
SELECT version, dirty FROM schema_migrations;
-- version: broj poslednje izvršene migracije (npr. 6)
-- dirty: true ako je poslednja migracija pucala na pola
```

Svaka migracija ima `up` i `down` varijantu:

```
migrations/
├── 000001_create_users.up.sql      ← kreira tabelu users
├── 000001_create_users.down.sql    ← briše tabelu users (rollback)
├── 000002_create_orders.up.sql
├── 000002_create_orders.down.sql
└── ...
```

Migracije se izvršavaju jednom i nikad dvaput — `schema_migrations` tabela prati koje su već urađene.

### Ručno upravljanje (van Dockera)

```bash
cd backend

# Izvršavanje svih pending migracija
go run -tags 'postgres' \
  github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
  -path ./migrations \
  -database "postgres://user:pass@localhost:5432/toystore?sslmode=disable" \
  up

# Rollback poslednje migracije
go run -tags 'postgres' \
  github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
  -path ./migrations \
  -database "postgres://user:pass@localhost:5432/toystore?sslmode=disable" \
  down 1

# Provera trenutnog stanja
go run -tags 'postgres' \
  github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
  -path ./migrations \
  -database "postgres://user:pass@localhost:5432/toystore?sslmode=disable" \
  version
```

### Dodavanje nove migracije

```bash
# Konvencija imenovanja: broj_opis.up.sql i broj_opis.down.sql
touch backend/migrations/000007_add_reviews.up.sql
touch backend/migrations/000007_add_reviews.down.sql
```

```sql
-- 000007_add_reviews.up.sql
CREATE TABLE reviews (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toy_id     INTEGER NOT NULL,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```sql
-- 000007_add_reviews.down.sql
DROP TABLE IF EXISTS reviews;
```

---

## 🔍 Detaljan pregled Go arhitekture

### Primer kompletnog toka: dodavanje u korpu

Svaki HTTP zahtev prolazi kroz sve slojeve. Evo konkretnog primera za `POST /api/cart`:

```
POST /api/cart
{ "toy_id": 6, "quantity": 1 }
Authorization: Bearer eyJ...
```

**1. Router** (`internal/router/router.go`) prima zahtev i propušta ga kroz middleware:

```go
cartGroup := r.Group("/api/cart")
cartGroup.Use(authMiddleware.RequireAuth())   // verifikuje JWT
{
    cartGroup.POST("", cartHandler.AddToCart)
}
```

**2. Middleware** (`internal/auth/middleware.go`) verifikuje token i upisuje userID u context:

```go
func (m *Middleware) RequireAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        // parsira "Authorization: Bearer <token>"
        // validira potpis i istek
        // c.Set("userID", claims.UserID)
        c.Next()
    }
}
```

**3. Handler** (`internal/handlers/cart_handler.go`) čita telo zahteva i poziva servis:

```go
func (h *CartHandler) AddToCart(c *gin.Context) {
    userID := c.GetString("userID")

    var req AddToCartRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        respondValidationError(c, err)
        return
    }

    item, err := h.service.AddItem(c.Request.Context(), userID, req.ToyID, req.Quantity)
    if err != nil {
        respondError(c, http.StatusBadRequest, "CART_ERROR", err.Error())
        return
    }

    c.JSON(http.StatusCreated, gin.H{"data": item})
}
```

**4. Service** (`internal/services/cart_service.go`) sadrži poslovnu logiku:

```go
func (s *CartService) AddItem(ctx context.Context, userID string, toyID int, qty int) (*models.CartItem, error) {
    // Verifikuj da igračka postoji (poziva ToyService koji koristi Redis keš)
    toy, err := s.toyService.GetByID(ctx, toyID)
    if err != nil {
        return nil, fmt.Errorf("toy not found: %w", err)
    }

    // Pozovi repository za DB operaciju
    return s.repo.AddOrUpdate(ctx, userID, toyID, toy.Name, toy.Image, toy.Price, qty)
}
```

**5. Repository** (`internal/repository/cart_repository.go`) izvršava SQL:

```go
func (r *CartRepository) AddOrUpdate(ctx context.Context, userID string, toyID int,
    name, image string, price float64, qty int) (*models.CartItem, error) {
    // UPSERT — ako već postoji, poveća količinu
    row := r.db.QueryRow(ctx, `
        INSERT INTO cart_items (user_id, toy_id, toy_name_cache, toy_image_cache, price_cache, quantity)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, toy_id)
        DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                      updated_at = NOW()
        RETURNING id, user_id, toy_id, toy_name_cache, toy_image_cache,
                  price_cache, quantity, updated_at
    `, userID, toyID, name, image, price, qty)

    var item models.CartItem
    if err := row.Scan(&item.ID, /* ... */); err != nil {
        return nil, fmt.Errorf("failed to add cart item: %w", err)
    }
    return &item, nil
}
```

Svaki sloj ima jednu jasnu odgovornost. Promena SQL upita ne zahteva dodirivanje handlera ili servisa.

### Primer strukturiranog logovanja

Svaki HTTP zahtev se loguje kroz `requestLogger` middleware koji zerolog piše kao JSON:

```json
{
  "level": "info",
  "client_ip": "172.18.0.1",
  "method": "POST",
  "path": "/api/cart",
  "status": 201,
  "latency": "12.34ms",
  "user_id": "550e8400-e29b-41d4-a716-446655440001",
  "time": "2026-03-19T14:30:00Z"
}
```

Cache operacije se loguju na `debug` nivou:

```json
{"level":"debug","key":"toys:all","message":"cache_hit"}
{"level":"debug","key":"toy:6","message":"cache_miss"}
{"level":"warn","key":"toys:all","error":"redis: connection refused","message":"failed to cache toys"}
```

Praćenje logova u realnom vremenu:

```bash
docker-compose logs -f backend           # svi logovi
docker-compose logs -f backend | grep '"status":4'  # samo 4xx greške
docker-compose logs -f backend | grep 'cache_miss'  # cache miss-ovi
```

---

## 🎨 Frontend arhitektura — detalji

### Server vs Client Components

Next.js 14 App Router razlikuje Server Components (podrazumevano) i Client Components (`'use client'`).

**Server Component** — izvršava se na serveru, nema pristupa browser API-jima:

```typescript
// src/app/page.tsx — Server Component
// Fetch se dešava na serveru, unutar Docker mreže
export default async function HomePage() {
  const [toys, ageGroups, toyTypes] = await Promise.all([
    fetchJSON<Toy[]>('/api/toys'),        // http://backend:8080/api/toys
    fetchJSON<AgeGroup[]>('/api/toys/age-groups'),
    fetchJSON<ToyType[]>('/api/toys/types'),
  ]);

  // Provera auth stanja čitanjem cookie-ja (server-side)
  const cookieStore = await cookies();
  const hasToken = cookieStore.has('access_token');

  return (
    <main>
      <HeroSection />
      <FeaturedToys toys={toys ?? []} isAuthenticated={hasToken} />
    </main>
  );
}
```

Prednosti: nema JavaScript na klijentu za data fetching, nema loading stanja, sadržaj je u HTML-u koji pretraživači indexiraju.

**Client Component** — izvršava se u browser-u, ima pristup hooks-ima i DOM API-ju:

```typescript
// src/components/home/FeaturedToys.tsx
'use client';

export function FeaturedToys({ toys, isAuthenticated }: FeaturedToysProps) {
  const { addItem } = useCartStore();           // Zustand store
  const { isInWishlist } = useWishlistStore();
  const [loading, setLoading] = useState(false);

  // Interaktivnost — klik na dugme, poziv API-ja
  async function handleAddToCart(toyId: number) {
    setLoading(true);
    await addItem(toyId, 1);
    setLoading(false);
  }

  return (/* JSX sa onClick handlerima */);
}
```

### Zustand store — primer

Cart store (`src/store/cartStore.ts`) sadrži svo stanje korpe i sve akcije:

```typescript
export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  itemCount: 0,
  isLoading: false,
  error: null,

  fetchCart: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<CartResponse>('/cart');
      const { items, subtotal } = response.data.data;
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      set({ items, subtotal, itemCount, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Greška pri učitavanju korpe', isLoading: false });
    }
  },

  addItem: async (toyId: number, quantity: number) => {
    set({ error: null, isLoading: true });
    try {
      await api.post('/cart', { toy_id: toyId, quantity });
      const response = await api.get<CartResponse>('/cart');
      const { items, subtotal } = response.data.data;
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      set({ items, subtotal, itemCount, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Nije uspelo dodavanje u korpu', isLoading: false });
      throw error;
    }
  },
}));
```

### useCart hook — wrapper oko Zustand store-a

Komponente ne koriste `cartStore` direktno, već `useCart` hook (`src/hooks/useCart.ts`) koji wrap-uje store i automatski poziva `fetchCart()` pri mount-u. Ovo eliminiše ponavljanje `useEffect(() => { fetchCart() }, [])` u svakoj komponenti:

```typescript
// components/Navbar.tsx, checkout/page.tsx — svi koriste isti pattern
export function useCart() {
  const store = useCartStore();
  useEffect(() => { store.fetchCart(); }, []);
  return store;
}
```

### Zod validacija sa srpskim porukama

Svi form input-i prolaze kroz Zod sheme definisane u `src/lib/validators.ts`:

```typescript
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Korisničko ime mora imati najmanje 3 karaktera')
    .max(50, 'Korisničko ime ne sme biti duže od 50 karaktera'),
  email: z
    .string()
    .email('Neispravan format email adrese'),
  password: z
    .string()
    .min(8, 'Lozinka mora imati najmanje 8 karaktera'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Lozinke se ne podudaraju',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;
```

Greška validacije se prikazuje odmah ispod polja, bez slanja zahteva na server.

### Axios interceptor — detalji

`src/lib/api.ts` definiše interceptor koji transparentno upravlja JWT tokenima:

```typescript
// Request interceptor — dodaje token pre slanja
api.interceptors.request.use(async (config) => {
  const token = getAccessToken();
  if (token) {
    if (isTokenExpired(token)) {
      // Token istekao — obnovi ga pre slanja zahteva
      const newToken = await refreshAccessToken();
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
      } else {
        // Refresh neuspešan — redirect na login
        window.location.href = '/login';
        return Promise.reject(new Error('Token refresh failed'));
      }
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — hvata 401 i pokušava refresh
api.interceptors.response.use(
  response => response,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Ne redirectuje ako korisnik nije ulogovan (nema refresh token)
      if (!getRefreshToken()) return Promise.reject(error);
      // Pokušaj refresh pa ponovi originalni zahtev
    }
    return Promise.reject(error);
  }
);
```

---

## 🔒 Kompletna SQL šema

Za referencu — kompletna šema baze podataka kao što je definisana u migracijama:

```sql
-- Ekstenzija za UUID generisanje
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Korisnici ────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
    avatar_url    TEXT,
    address       TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ─── Porudžbine ───────────────────────────────────────────────────────────────
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN
                       ('pending','processing','shipped','delivered','cancelled')),
    payment_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN
                       ('pending','paid','failed','refunded')),
    total_amount     NUMERIC(10,2) NOT NULL,
    shipping_address TEXT NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS cancellation_requested BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cancellation_reason    TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_approved  BOOLEAN,
    ADD COLUMN IF NOT EXISTS cancellation_response  TEXT;

CREATE INDEX idx_orders_user_id    ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ─── Stavke porudžbine (snapshot) ────────────────────────────────────────────
CREATE TABLE order_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    toy_id            INTEGER NOT NULL,
    toy_name          VARCHAR(255) NOT NULL,
    toy_image_url     TEXT,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ─── Korpa ────────────────────────────────────────────────────────────────────
CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toy_id          INTEGER NOT NULL,
    toy_name_cache  VARCHAR(255) NOT NULL,
    toy_image_cache TEXT,
    price_cache     NUMERIC(10,2) NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, toy_id)
);

CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);

-- ─── Lista želja ──────────────────────────────────────────────────────────────
CREATE TABLE wishlist_items (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toy_id     INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, toy_id)
);

CREATE INDEX idx_wishlist_user_id ON wishlist_items(user_id);
```

---

## 🧰 Korisne komande za razvoj

### Inspekcija baze podataka

```bash
# Ulaz u PostgreSQL shell
docker-compose exec db psql -U toystore_user -d toystore

# Listanje tabela
\dt

# Pregled korisnika
SELECT id, username, email, role, is_active FROM users;

# Pregled porudžbina sa statusima
SELECT o.id, u.username, o.status, o.payment_status,
       o.total_amount, o.created_at
FROM orders o
JOIN users u ON u.id = o.user_id
ORDER BY o.created_at DESC;

# Pregled korpe korisnika
SELECT c.toy_id, c.toy_name_cache, c.price_cache, c.quantity
FROM cart_items c
JOIN users u ON u.id = c.user_id
WHERE u.email = 'user@toystore.com';
```

### Inspekcija Redis-a

```bash
# Ulaz u Redis CLI
docker-compose exec redis redis-cli --pass $REDIS_PASSWORD

# Listanje svih ključeva
KEYS *

# Provera TTL-a keša igračaka
TTL toys:all

# Pregled sadržaja (JSON)
GET toys:all | python3 -m json.tool | head -50

# Provera da li postoji refresh token za korisnika
KEYS *refresh*
```

### Logovi i debugging

```bash
# Praćenje svih logova u realnom vremenu
docker-compose logs -f

# Samo backend logovi
docker-compose logs -f backend

# Filtriranje grešaka (4xx i 5xx)
docker-compose logs -f backend 2>&1 | grep '"status":[45]'

# Praćenje cache miss-ova
docker-compose logs -f backend 2>&1 | grep 'cache_miss'

# Restart pojedinog servisa bez rebuilda
docker-compose restart backend
docker-compose restart frontend
```

### Reset i čišćenje

```bash
# Kompletni reset (briše sve podatke)
docker-compose down -v
docker-compose up --build

# Rebuild samo frontenda (npr. posle izmene koda)
docker-compose up --build frontend

# Brisanje nekorišćenih Docker image-a
docker image prune -f
```

---

## 🐛 Troubleshooting

### Česti problemi i rešenja

**Problem:** Backend ne može da se poveže na bazu podataka pri prvom pokretanju.

```
error: failed to connect to database: connection refused
```

**Rešenje:** Docker Compose `depends_on` sa `condition: service_healthy` čeka health check, ali ako PostgreSQL kontejner nije bio prethodno kreiran može potrajati. Sačekajte 30-60 sekundi i ponovo pokrenite:

```bash
docker-compose down && docker-compose up --build
```

---

**Problem:** `schema_migrations: dirty database version`

**Rešenje:** Migracija je prekinuta na pola. Označite kao čisto i ponovo pokrenite:

```bash
docker-compose exec db psql -U toystore_user -d toystore \
  -c "UPDATE schema_migrations SET dirty = false"
docker-compose restart backend
```

---

**Problem:** Frontend prikazuje `Internal Server Error` pri učitavanju home stranice.

**Rešenje:** Server Component ne može da dosegne backend. Proverite da li backend radi:

```bash
docker-compose ps                    # svi servisi moraju biti "Up"
docker-compose logs backend | tail   # greška pri pokretanju?
curl http://localhost/health         # mora vratiti {"status":"ok"}
```

---

**Problem:** Stripe plaćanje ne radi — `payment intent creation failed`.

**Rešenje:** Proverite da li `STRIPE_SECRET_KEY` počinje sa `sk_test_` ili `sk_live_`:

```bash
# Provera vrednosti u pokrenutom kontejneru
docker-compose exec backend env | grep STRIPE_SECRET_KEY
```

Ako ključ nije ispravan, sistem će raditi u mock modu (ne greška, samo ne poziva Stripe). Ako ključ počinje sa `sk_` ali plaćanje i dalje ne prolazi — proverite da li je ključ validan na Stripe Dashboard-u.

---

**Problem:** `wishlist`/`cart` API vraća 401 za nelogovane korisnike i redirect-uje na `/login`.

**Rešenje:** Ovo je namerno ponašanje kada korisnik ima **isteklu sesiju**. Ako korisnik nikad nije bio ulogovan, 401 se tiho ignoriše. Axios interceptor proverava postojanje refresh tokena pre nego što redirectuje — bez refresh tokena, ne redirectuje.

---

**Problem:** Redis nije dostupan, backend se neće pokrenuti.

**Rešenje:** Redis je required zavisnost. Proverite lozinku:

```bash
# Provera Redis konekcije
docker-compose exec redis redis-cli --pass $REDIS_PASSWORD ping
# Mora vratiti: PONG
```

Ako `REDIS_PASSWORD` u `.env` ne odgovara lozinci sa kojom je Redis pokrenut, uradite reset:

```bash
docker-compose down -v    # briše Redis volume sa starom lozinkom
docker-compose up --build
```

---

## 📄 Licenca

```
MIT License — slobodna upotreba za edukativne svrhe.
```

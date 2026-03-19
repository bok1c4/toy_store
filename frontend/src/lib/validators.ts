import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Neispravan format email adrese'),
  password: z.string().min(1, 'Lozinka je obavezna'),
});

export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Korisničko ime mora imati najmanje 3 karaktera')
    .max(50, 'Korisničko ime ne sme imati više od 50 karaktera'),
  email: z.string().email('Neispravan format email adrese'),
  password: z.string().min(8, 'Lozinka mora imati najmanje 8 karaktera'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Lozinke se ne podudaraju',
  path: ['confirmPassword'],
});

export type RegisterForm = z.infer<typeof registerSchema>;

export const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Korisničko ime mora imati najmanje 3 karaktera')
    .max(50, 'Korisničko ime ne sme imati više od 50 karaktera')
    .optional(),
  address: z.string().optional(),
  avatar_url: z.string().url('Neispravan URL format').optional().or(z.literal('')),
});

export type ProfileForm = z.infer<typeof profileSchema>;

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Trenutna lozinka je obavezna'),
  new_password: z.string().min(8, 'Nova lozinka mora imati najmanje 8 karaktera'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Lozinke se ne podudaraju',
  path: ['confirm_password'],
});

export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export const checkoutSchema = z.object({
  shippingAddress: z
    .string()
    .min(10, 'Adresa za dostavu mora imati najmanje 10 karaktera')
    .max(500, 'Adresa za dostavu ne sme imati više od 500 karaktera'),
});

export type CheckoutForm = z.infer<typeof checkoutSchema>;

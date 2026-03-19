FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations
EXPOSE 8080
CMD ["./server"]

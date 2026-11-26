FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o servidor main.go

FROM alpine:3.22

WORKDIR /app

COPY --from=builder /app/servidor .

EXPOSE 8004

CMD ["./servidor"]


FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod ./

COPY config/ config/
COPY mattermost/ mattermost/
COPY handlers/ handlers/
COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o forwarder .

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app/

COPY --from=builder /app/forwarder .

EXPOSE 8080

CMD ["./forwarder"]

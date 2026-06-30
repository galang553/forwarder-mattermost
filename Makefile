.PHONY: all build-server build-webapp clean package

all: package

build-server:
	@echo "Building Go server plugin binaries..."
	mkdir -p server/dist
	cd server && env GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o dist/plugin-linux-amd64 .
	cd server && env GOOS=darwin GOARCH=amd64 go build -ldflags="-w -s" -o dist/plugin-darwin-amd64 .
	cd server && env GOOS=windows GOARCH=amd64 go build -ldflags="-w -s" -o dist/plugin-windows-amd64.exe .

build-webapp:
	@echo "Building React webapp bundle..."
	cd webapp && npm install && npm run build

package: build-server build-webapp
	@echo "Creating plugin package..."
	mkdir -p dist/com.rivestudy.message-forwarder
	cp plugin.json dist/com.rivestudy.message-forwarder/
	mkdir -p dist/com.rivestudy.message-forwarder/server/dist
	cp server/dist/plugin-* dist/com.rivestudy.message-forwarder/server/dist/
	mkdir -p dist/com.rivestudy.message-forwarder/webapp/dist
	cp webapp/dist/main.js dist/com.rivestudy.message-forwarder/webapp/dist/
	cd dist && tar -czf com.rivestudy.message-forwarder.tar.gz com.rivestudy.message-forwarder
	@echo "Plugin packaged successfully: dist/com.rivestudy.message-forwarder.tar.gz"

clean:
	rm -rf server/dist webapp/dist dist


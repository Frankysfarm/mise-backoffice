import http from "node:http"

const listenPort = Number(process.argv[2])
const upstreamPort = Number(process.argv[3])
if (!Number.isInteger(listenPort) || !Number.isInteger(upstreamPort)) {
  throw new Error("usage: postgrest-prefix-proxy.mjs listen-port upstream-port")
}

http.createServer((request, response) => {
  if (!request.url?.startsWith("/rest/v1")) {
    response.writeHead(404).end()
    return
  }
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: upstreamPort,
    method: request.method,
    path: request.url.slice("/rest/v1".length) || "/",
    headers: { ...request.headers, host: `127.0.0.1:${upstreamPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })
  upstream.on("error", () => response.writeHead(502).end())
  request.pipe(upstream)
}).listen(listenPort, "127.0.0.1")

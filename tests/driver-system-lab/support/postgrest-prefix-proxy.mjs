import http from "node:http"

const listenPort = Number(process.argv[2])
const upstreamPort = Number(process.argv[3])
const authUpstreamPort = Number(process.argv[4])
if (!Number.isInteger(listenPort) || !Number.isInteger(upstreamPort) || !Number.isInteger(authUpstreamPort)) {
  throw new Error("usage: postgrest-prefix-proxy.mjs listen-port postgrest-port auth-port")
}

http.createServer((request, response) => {
  const isRest = request.url?.startsWith("/rest/v1")
  const isAuth = request.url?.startsWith("/auth/v1")
  if (!isRest && !isAuth) {
    response.writeHead(404).end()
    return
  }
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: isRest ? upstreamPort : authUpstreamPort,
    method: request.method,
    path: request.url.slice(isRest ? "/rest/v1".length : "/auth/v1".length) || "/",
    headers: { ...request.headers, host: `127.0.0.1:${isRest ? upstreamPort : authUpstreamPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })
  upstream.on("error", () => response.writeHead(502).end())
  request.pipe(upstream)
}).listen(listenPort, "127.0.0.1")

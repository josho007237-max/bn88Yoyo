import http from "node:http";

function sendRequest(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const req = http.request(
        {
          method,
          host: "127.0.0.1",
          port,
          path: url,
          headers: { "content-type": "application/json" },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            server.close();
            const bodyData = data ? JSON.parse(data) : undefined;
            resolve({ status: res.statusCode || 0, body: bodyData, headers: res.headers });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (body !== undefined) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

function request(app) {
  const wrap = (method, url) => ({
    send: (payload) => sendRequest(app, method, url, payload),
  });

  return {
    get: (url) => sendRequest(app, "GET", url),
    post: (url) => wrap("POST", url),
    put: (url) => wrap("PUT", url),
    patch: (url) => wrap("PATCH", url),
    delete: (url) => wrap("DELETE", url),
  };
}

export default request;

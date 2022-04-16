import http2 from "http2";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import handler from "serve-handler";
import nanobuffer from "nanobuffer";

let connections = [];

// TODO: nanobufferis a fixed size array, newer mesasges will
// overwrite the old ones once its full
const msg = new nanobuffer(5);
const getMsgs = () => Array.from(msg).reverse();

msg.push({
  user: "brian",
  text: "whut wut *ts whut *ts whut *ts whut",
  time: Date.now(),
});

// the two commands you'll have to run in the root directory of the project are
// (not inside the backend folder)
//
// openssl req -new -newkey rsa:2048 -new -nodes -keyout key.pem -out csr.pem
// openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out server.crt
//
// http2 only works over HTTPS
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = http2.createSecureServer({
  cert: fs.readFileSync(path.join(__dirname, "/../server.crt")),
  key: fs.readFileSync(path.join(__dirname, "/../key.pem")),
});

/*
 *
 * Code goes here
 *
 */
server.on('stream', (stream, headers) => {
  const method = headers[":method"]
  const path = headers[':path']

  // streams will open for everything, we want just GETs on /msgs

  if (path === '/msgs' && method === 'GET') {

    console.log("stream method: ", method)
    console.log('stream path', path)

    console.log("connected")
    stream.respond({
      ":status": 200,
      "content-type": "text/plain; charset=utf-8"
    })

    // ADD a stream to the pool of conenctions
    const newNumberOfUsers = connections.length + 1
    // this is for the new stream
    stream.write(JSON.stringify({ msg: getMsgs(), users: newNumberOfUsers }))

    // notify OTHER connections of new member (before adding them into connections) effectively 'introducing' the new stream
    // this is for the OTHER streams in the pool
    connections.forEach(stream => {
      stream.write(JSON.stringify({ users: newNumberOfUsers }))
    })

    // add current stream to existing pool of connections
    connections.push(stream)


    // this is a callback, doesn't happen until 'close' event happens
    stream.on('close', () => {
      connections = connections.filter(s => s !== stream)
      connections.forEach(stream => {
        stream.write(JSON.stringify({ users: connections.length }))
      })
      console.log("disconnected")
    })
  }
})

server.on("request", async (req, res) => {
  const path = req.headers[":path"];
  const method = req.headers[":method"];

  if (path !== "/msgs") {
    // handle the static assets
    return handler(req, res, {
      public: "./frontend",
    });
  } else if (method === "POST") {
    // get data out of post
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const data = Buffer.concat(buffers).toString();
    const { user, text } = JSON.parse(data);

    msg.push({ user, text, time: Date.now() })

    console.log("notifying all connections: ", connections.length)

    // complete request
    res.end()

    // notif all connected users (pubsub)

    connections.forEach(stream => {
      stream.write(JSON.stringify({ msg: getMsgs(), users: connections.length }))
    })


  }
});

// start listening
const port = process.env.PORT || 8080;
server.listen(port, () =>
  console.log(
    `Server running at https://localhost:${port} - make sure you're on httpS, not http`
  )
);

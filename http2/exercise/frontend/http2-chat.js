const chat = document.getElementById("chat");
const msgs = document.getElementById("msgs");
const presence = document.getElementById("presence-indicator");
const users = document.getElementById("user-count")


// this will hold all the most recent messages
let allChat = [];
let userCount = 0;

chat.addEventListener("submit", function (e) {
  e.preventDefault();
  postNewMsg(chat.elements.user.value, chat.elements.text.value);
  chat.elements.text.value = "";
});

async function postNewMsg(user, text) {
  const data = {
    user,
    text,
  };

  // request options
  const options = {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
  };

  // send POST request
  // we're not sending any json back, but we could
  await fetch("/msgs", options);
}

async function getNewMsgs() {
  let reader;
  const utf8Decoder = new TextDecoder('utf-8')
  try {
    const res = await fetch("/msgs");
    reader = res.body.getReader()
  } catch (e) {
    console.log("connection error", e)
  }
  presence.innerText = "🟢"

  do {
    let readerResponse;

    // read from stream ONCE
    try {
      readerResponse = await reader.read()
    } catch (e) {
      console.error("reader failed", e)
      presence.innerText = "🔴 - disconnectd. please refresh page."
      return
    }

    done = readerResponse.done
    const chunk = utf8Decoder.decode(readerResponse.value, { stream: true })
    console.log("chunk: ", chunk)
    if (chunk) {
      try {
        const json = JSON.parse(chunk)
        allChat = json.msg
        userCount = json.users
        console.log("how mayn users", userCount)
        render()
      } catch (e) {
        console.error("parse error", e)
      }
    }

  } while (!done)

}

function render() {
  if (allChat !== undefined) {

    const html = allChat.map(({ user, text, time, id }) =>
      template(user, text, time, id)
    );
    msgs.innerHTML = html.join("\n");
  }
  if (userCount !== undefined) {
    users.innerHTML = userCount
  }
}

const template = (user, msg) =>
  `<li class="collection-item"><span class="badge">${user}</span>${msg}</li>`;

getNewMsgs();

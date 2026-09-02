const $ = s => document.querySelector(s);

const SUPABASE_URL = "https://uopwsaymtomnxfmacsnu.supabase.co";
const SUPABASE_KEY = "sb_publishable_z6vlfZ8IsWgM4clPEWIavA_YBV4GlQ2";

let username = localStorage.getItem("vibechat_name") || "";
let currentRoom = "Chill Zone";

const roomIcons = {
  "Chill Zone": "🌙",
  "Music Lounge": "🎵",
  "Gaming": "🎮",
  "Random": "💭"
};

const samples = [
  ["Nova", "Welcome everyone! 👋"],
  ["Arya", "Anyone listening to something good? 🎵"],
  ["Zayn", "This room is actually pretty chill 😎"],
  ["Pixel", "Heyyy everyone ✨"]
];

async function dbRequest(path, options = {}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
        ...(options.headers || {})
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

function enter(room = currentRoom) {
  const name =
    ($("#nameInput").value.trim() || username || "Guest").slice(0, 20);

  username = name;
  localStorage.setItem("vibechat_name", name);

  currentRoom = room;

  $("#home").classList.add("hidden");
  $("#chat").classList.remove("hidden");

  $("#meName").textContent = name;

  renderRoom();
  renderMessages();
}

function renderRoom() {
  $("#roomTitle").textContent =
    (roomIcons[currentRoom] || "💬") + " " + currentRoom;

  document.querySelectorAll(".room").forEach(x => {
    x.classList.toggle(
      "active",
      x.dataset.room === currentRoom
    );
  });
}

async function renderMessages() {
  const box = $("#messages");
  box.innerHTML = "";

  samples.forEach(([name, text]) => {
    addMsg(name, text, false);
  });

  try {
    const messages = await dbRequest(
      `messages?room=eq.${encodeURIComponent(currentRoom)}&select=*&order=created_at.asc`
    );

    messages.forEach(message => {
      addMsg(
        message.name,
        message.text,
        message.name === username
      );
    });

    box.scrollTop = box.scrollHeight;

  } catch (error) {
    console.error("Load messages error:", error);
  }
}

function addMsg(name, text, mine) {
  const d = document.createElement("div");

  d.className = "msg" + (mine ? " mine" : "");

  d.innerHTML = `
    <div class="meta">${escapeHtml(name)}</div>
    <div class="bubble">${escapeHtml(text)}</div>
  `;

  $("#messages").appendChild(d);
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c])
  );
}

async function send() {
  const input = $("#messageInput");
  const text = input.value.trim();

  if (!text || !username) return;

  try {
    await dbRequest("messages", {
      method: "POST",
      body: JSON.stringify({
        room: currentRoom,
        name: username,
        text: text
      })
    });

    addMsg(username, text, true);

    input.value = "";
    $("#messages").scrollTop = 999999;

  } catch (error) {
    console.error("Send message error:", error);
    alert("Error: " + error.message);
  }
}

$("#joinBtn").onclick = () => enter();

$("#nameInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    enter();
  }
});

document.querySelectorAll(".roomcard").forEach(button => {
  button.onclick = () => {
    enter(button.dataset.room);
  };
});

document.querySelectorAll(".room").forEach(button => {
  button.onclick = () => {
    currentRoom = button.dataset.room;
    renderRoom();
    renderMessages();
  };
});

$("#sendBtn").onclick = send;

$("#messageInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    send();
  }
});

$("#backBtn").onclick = () => {
  $("#chat").classList.add("hidden");
  $("#home").classList.remove("hidden");
};

$("#emojiBtn").onclick = () => {
  $("#emojiPanel").classList.toggle("hidden");
};

$("#emojiPanel").onclick = e => {
  const emoji = e.target.textContent.trim();

  if (emoji) {
    const input = $("#messageInput");
    input.value += emoji;
    input.focus();
  }
};

$("#themeBtn").onclick = () => {
  document.body.classList.toggle("light");
};

if (username) {
  $("#nameInput").value = username;
}

renderRoom();

const $ = s => document.querySelector(s);

const SUPABASE_URL = "https://uopwsaymtomnxfmacsnu.supabase.co";
const SUPABASE_KEY = "sb_publishable_z6vlfZ8IsWgM4clPEWIavA_YBV4GlQ2";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let username = localStorage.getItem("vibechat_name") || "";
let currentRoom = "Chill Zone";
let realtimeChannel = null;
let onlineUserId = null;

const displayedMessages = new Set();

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

async function joinOnlineUsers() {
  try {
    const { data, error } = await supabaseClient
      .from("online_users")
      .insert({
        username: username,
        room: currentRoom,
        last_seen: Date.now()
      })
      .select()
      .single();

    if (error) throw error;

    onlineUserId = data.id;

    console.log("Online user added:", data);

  } catch (error) {
    console.error("Online user error:", error);
  }
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
  setupRealtime();

  joinOnlineUsers();
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
  displayedMessages.clear();

  samples.forEach(([name, text]) => {
    addMsg(name, text, false);
  });

  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("room", currentRoom)
      .order("created_at", { ascending: true });

    if (error) throw error;

    data.forEach(message => {
      addMsg(
        message.name,
        message.text,
        message.name === username,
        message
      );
    });

    box.scrollTop = box.scrollHeight;

  } catch (error) {
    console.error("Load messages error:", error);
  }
}

function addMsg(name, text, mine, message = null) {
  const key = message
    ? `${message.room}|${message.name}|${message.text}|${message.created_at}`
    : `sample|${name}|${text}`;

  if (displayedMessages.has(key)) return;

  displayedMessages.add(key);

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
    const createdAt = Date.now();

    const { data, error } = await supabaseClient
      .from("messages")
      .insert({
        room: currentRoom,
        name: username,
        text: text,
        created_at: createdAt
      })
      .select();

    if (error) throw error;

    if (data && data[0]) {
      addMsg(username, text, true, data[0]);
    }

    input.value = "";
    $("#messages").scrollTop = $("#messages").scrollHeight;

  } catch (error) {
    console.error("Send message error:", error);
    alert("Error: " + error.message);
  }
}

function setupRealtime() {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabaseClient
    .channel("room-" + currentRoom)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room=eq.${currentRoom}`
      },
      payload => {
        const message = payload.new;

        addMsg(
          message.name,
          message.text,
          message.name === username,
          message
        );

        $("#messages").scrollTop = $("#messages").scrollHeight;
      }
    )
    .subscribe(status => {
      console.log("Realtime:", status);
    });
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
    setupRealtime();
    joinOnlineUsers();
  };
});

$("#sendBtn").onclick = send;

$("#messageInput").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    send();
  }
});

$("#backBtn").onclick = () => {
  if (realtimeChannel) {
    supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

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

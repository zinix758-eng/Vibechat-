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
let onlineChannel = null;
let onlineUserId = null;
let heartbeatTimer = null;

const displayedMessages = new Set();

const roomIcons = {
  "Chill Zone": "🌙",
  "Music Lounge": "🎵",
  "Gaming": "🎮",
  "Random": "💭"
};

const defaultTopics = {
  "Chill Zone": "Talk • Chill • Make new friends",
  "Music Lounge": "Music • Songs • Vibes",
  "Gaming": "Gaming • Fun • Squad",
  "Random": "Random talks • Anything goes"
};

const samples = [
  ["Nova", "Welcome everyone! 👋"],
  ["Arya", "Anyone listening to something good? 🎵"],
  ["Zayn", "This room is actually pretty chill 😎"],
  ["Pixel", "Heyyy everyone ✨"]
];


/* =========================
   HELPERS
========================= */

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


/* =========================
   ROOM
========================= */

function renderRoom() {
  const title = $("#roomTitle");

  if (title) {
    title.textContent =
      (roomIcons[currentRoom] || "💬") +
      " " +
      currentRoom;
  }

  document.querySelectorAll(".room").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.room === currentRoom
    );
  });
}


/* =========================
   ROOM TOPIC
========================= */

async function loadRoomTopic() {
  const topic = $("#roomTopic");

  if (!topic) return;

  topic.textContent =
    defaultTopics[currentRoom] || "";

  try {
    const { data, error } = await supabaseClient
      .from("room_topics")
      .select("topic")
      .eq("room", currentRoom)
      .maybeSingle();

    if (error) throw error;

    if (data && data.topic) {
      topic.textContent = data.topic;
    }

  } catch (error) {
    console.log("Topic load:", error.message);
  }
}


/* =========================
   EDIT TOPIC
========================= */

function openTopicEditor() {
  const modal = $("#topicModal");
  const input = $("#topicInput");
  const roomName = $("#topicRoomName");

  if (!modal || !input) return;

  roomName.textContent = currentRoom;

  input.value =
    $("#roomTopic").textContent ||
    defaultTopics[currentRoom] ||
    "";

  modal.classList.remove("hidden");

  setTimeout(() => {
    input.focus();
  }, 100);
}


function closeTopicEditor() {
  const modal = $("#topicModal");

  if (modal) {
    modal.classList.add("hidden");
  }
}


async function saveRoomTopic() {
  const input = $("#topicInput");

  if (!input) return;

  const topic = input.value.trim().slice(0, 100);

  if (!topic) {
    alert("Topic empty nahi ho sakta.");
    return;
  }

  try {

    const { error } = await supabaseClient
      .from("room_topics")
      .upsert(
        {
          room: currentRoom,
          topic: topic
        },
        {
          onConflict: "room"
        }
      );

    if (error) throw error;

    $("#roomTopic").textContent = topic;

    closeTopicEditor();

  } catch (error) {

    console.error("Save topic error:", error);

    alert(
      "Topic save nahi hua: " +
      error.message
    );

  }
}


/* =========================
   ONLINE USERS
========================= */

async function removeOwnOnlineUser() {

  if (!onlineUserId) return;

  try {
    await supabaseClient
      .from("online_users")
      .delete()
      .eq("id", onlineUserId);
  } catch (error) {
    console.log("Remove online user:", error.message);
  }

  onlineUserId = null;
}


async function joinOnlineUsers() {

  try {

    // Is browser ki purani ID remove karo
    await removeOwnOnlineUser();

    const { data, error } = await supabaseClient
      .from("online_users")
      .insert({
        username: username,
        room: currentRoom,
        last_seen: Date.now()
      })
      .select("id")
      .single();

    if (error) throw error;

    onlineUserId = data.id;

    await loadOnlineUsers();

  } catch (error) {

    console.error(
      "Join online error:",
      error
    );

  }
}


async function loadOnlineUsers() {

  try {

    const cutoff =
      Date.now() - 45000;

    const { data, error } =
      await supabaseClient
        .from("online_users")
        .select("id, username, room, last_seen")
        .eq("room", currentRoom)
        .gt("last_seen", cutoff)
        .order("last_seen", {
          ascending: false
        });

    if (error) throw error;

    const users = data || [];

    const countElement = $("#onlineCount");

    if (countElement) {
      countElement.textContent =
        users.length;
    }

    const people = $("#people");

    if (!people) return;

    people.innerHTML =
      "<h3>Online now</h3>";

    users.forEach(user => {

      const div =
        document.createElement("div");

      div.className =
        user.id === onlineUserId
          ? "me"
          : "person";

      div.innerHTML = `
        <span>🟢</span>
        <b>${escapeHtml(user.username)}</b>
        <small>
          ${
            user.id === onlineUserId
              ? "You"
              : "Online"
          }
        </small>
      `;

      people.appendChild(div);

    });

  } catch (error) {

    console.error(
      "Load online users error:",
      error
    );

  }
}


async function updateHeartbeat() {

  if (!onlineUserId) return;

  try {

    const { error } =
      await supabaseClient
        .from("online_users")
        .update({
          username: username,
          room: currentRoom,
          last_seen: Date.now()
        })
        .eq("id", onlineUserId);

    if (error) {

      console.error(
        "Heartbeat error:",
        error.message
      );

      await joinOnlineUsers();

      return;
    }

    await loadOnlineUsers();

  } catch (error) {

    console.error(
      "Heartbeat error:",
      error.message
    );

  }
}


function startHeartbeat() {

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  heartbeatTimer =
    setInterval(
      updateHeartbeat,
      15000
    );
}


function setupOnlineRealtime() {

  if (onlineChannel) {

    supabaseClient.removeChannel(
      onlineChannel
    );

    onlineChannel = null;
  }

  onlineChannel =
    supabaseClient
      .channel(
        "online-users-" +
        Date.now()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "online_users"
        },
        () => {
          loadOnlineUsers();
        }
      )
      .subscribe();

}


/* =========================
   ENTER CHAT
========================= */

async function enter(room = currentRoom) {

  const input = $("#nameInput");

  const name =
    (
      input.value.trim() ||
      username ||
      "Guest"
    ).slice(0, 20);

  username = name;

  localStorage.setItem(
    "vibechat_name",
    username
  );

  currentRoom = room;

  $("#home")
    .classList
    .add("hidden");

  $("#chat")
    .classList
    .remove("hidden");

  renderRoom();

  await loadRoomTopic();

  await joinOnlineUsers();

  startHeartbeat();

  setupOnlineRealtime();

  await renderMessages();

  setupRealtime();
}


/* =========================
   MESSAGES
========================= */

async function renderMessages() {

  const box = $("#messages");

  if (!box) return;

  box.innerHTML = "";

  displayedMessages.clear();

  samples.forEach(([name, text]) => {
    addMsg(
      name,
      text,
      false
    );
  });

  try {

    const { data, error } =
      await supabaseClient
        .from("messages")
        .select("*")
        .eq("room", currentRoom)
        .order("created_at", {
          ascending: true
        });

    if (error) throw error;

    (data || []).forEach(message => {

      addMsg(
        message.name,
        message.text,
        message.name === username,
        message
      );

    });

    box.scrollTop =
      box.scrollHeight;

  } catch (error) {

    console.error(
      "Messages error:",
      error
    );

  }
}


function addMsg(
  name,
  text,
  mine,
  message = null
) {

  const key = message
    ? `${message.room}|${message.name}|${message.text}|${message.created_at}`
    : `sample|${name}|${text}`;

  if (displayedMessages.has(key)) {
    return;
  }

  displayedMessages.add(key);

  const div =
    document.createElement("div");

  div.className =
    "msg" +
    (mine ? " mine" : "");

  div.innerHTML = `
    <div class="meta">
      ${escapeHtml(name)}
    </div>

    <div class="bubble">
      ${escapeHtml(text)}
    </div>
  `;

  $("#messages").appendChild(div);
}


/* =========================
   SEND MESSAGE
========================= */

async function send() {

  const input =
    $("#messageInput");

  const text =
    input.value.trim();

  if (!text || !username) {
    return;
  }

  try {

    const { data, error } =
      await supabaseClient
        .from("messages")
        .insert({
          room: currentRoom,
          name: username,
          text: text,
          created_at: Date.now()
        })
        .select();

    if (error) throw error;

    if (data && data[0]) {

      addMsg(
        username,
        text,
        true,
        data[0]
      );

    }

    input.value = "";

    $("#messages").scrollTop =
      $("#messages").scrollHeight;

  } catch (error) {

    console.error(
      "Send message error:",
      error
    );

    alert(
      "Message send error: " +
      error.message
    );

  }
}


/* =========================
   MESSAGE REALTIME
========================= */

function setupRealtime() {

  if (realtimeChannel) {

    supabaseClient.removeChannel(
      realtimeChannel
    );

    realtimeChannel = null;
  }

  realtimeChannel =
    supabaseClient
      .channel(
        "messages-" +
        currentRoom +
        "-" +
        Date.now()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter:
            `room=eq.${currentRoom}`
        },
        payload => {

          const message =
            payload.new;

          addMsg(
            message.name,
            message.text,
            message.name === username,
            message
          );

          $("#messages").scrollTop =
            $("#messages").scrollHeight;

        }
      )
      .subscribe(status => {

        console.log(
          "Messages realtime:",
          status
        );

      });

}


/* =========================
   USERS BUTTON
========================= */

$("#usersBtn").onclick = () => {

  $("#people")
    .classList
    .toggle("show");

};


/* =========================
   JOIN
========================= */

$("#joinBtn").onclick = () => {
  enter();
};


$("#nameInput").addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {
      enter();
    }

  }
);


/* =========================
   ROOM CARDS
========================= */

document
  .querySelectorAll(".roomcard")
  .forEach(button => {

    button.onclick = () => {

      enter(
        button.dataset.room
      );

    };

  });


/* =========================
   ROOM SIDEBAR
========================= */

document
  .querySelectorAll(".room")
  .forEach(button => {

    button.onclick = async () => {

      const newRoom =
        button.dataset.room;

      if (newRoom === currentRoom) {
        return;
      }

      currentRoom = newRoom;

      renderRoom();

      await joinOnlineUsers();

      await loadRoomTopic();

      await renderMessages();

      setupOnlineRealtime();

      setupRealtime();

    };

  });


/* =========================
   TOPIC BUTTONS
========================= */

$("#editTopicBtn").onclick =
  openTopicEditor;

$("#closeTopicBtn").onclick =
  closeTopicEditor;

$("#cancelTopicBtn").onclick =
  closeTopicEditor;

$("#saveTopicBtn").onclick =
  saveRoomTopic;


$("#topicInput").addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {
      saveRoomTopic();
    }

    if (e.key === "Escape") {
      closeTopicEditor();
    }

  }
);


/* =========================
   SEND
========================= */

$("#sendBtn").onclick =
  send;


$("#messageInput").addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {
      send();
    }

  }
);


/* =========================
   BACK
========================= */

$("#backBtn").onclick =
  async () => {

    if (heartbeatTimer) {

      clearInterval(
        heartbeatTimer
      );

      heartbeatTimer = null;
    }

    await removeOwnOnlineUser();

    if (realtimeChannel) {

      supabaseClient.removeChannel(
        realtimeChannel
      );

      realtimeChannel = null;
    }

    if (onlineChannel) {

      supabaseClient.removeChannel(
        onlineChannel
      );

      onlineChannel = null;
    }

    $("#chat")
      .classList
      .add("hidden");

    $("#home")
      .classList
      .remove("hidden");

  };


/* =========================
   EMOJI
========================= */

$("#emojiBtn").onclick =
  () => {

    $("#emojiPanel")
      .classList
      .toggle("hidden");

  };


$("#emojiPanel").onclick =
  e => {

    const emoji =
      e.target.textContent.trim();

    if (!emoji) return;

    const input =
      $("#messageInput");

    input.value += emoji;

    input.focus();

  };


/* =========================
   THEME
========================= */

$("#themeBtn").onclick =
  () => {

    document.body
      .classList
      .toggle("light");

  };


/* =========================
   START
========================= */

if (username) {

  $("#nameInput").value =
    username;

}

renderRoom();

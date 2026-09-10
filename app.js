const $ = s => document.querySelector(s);

/* =========================================================
   ZUNO — SUPABASE
========================================================= */

const SUPABASE_URL =
  "https://uopwsaymtomnxfmacsnu.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_z6vlfZ8IsWgM4clPEWIavA_YBV4GlQ2";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* =========================================================
   STATE
========================================================= */

let username =
  localStorage.getItem("zuno_name") ||
  localStorage.getItem("vibechat_name") ||
  "";

let currentUser = null;
let authMode = "login";

let currentRoom = "Chill Zone";
let privateUser = null;

let realtimeChannel = null;
let privateChannel = null;
let onlineChannel = null;
let typingChannel = null;

let heartbeatTimer = null;
let typingTimer = null;

let displayedMessages = new Set();
let displayedPrivateMessages = new Set();

let onlineUserId = null;

let currentProfile = {
  username: "",
  bio: "",
  avatar: ""
};

let currentXP = 0;
let currentLevel = 1;

let currentFeedPosts = [];
let currentCommunities = [];


/* =========================================================
   ROOMS
========================================================= */

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


/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));

}


function defaultAvatar(name) {

  const letter =
    String(name || "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    letter
  )}&background=667eea&color=fff&size=200`;
}


function formatDate(date) {

  if (!date) return "";

  const d = new Date(date);

  if (Number.isNaN(d.getTime()))
    return "";

  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function safeText(value, fallback = "") {

  const text = String(value ?? "").trim();

  return text || fallback;
}


function showElement(id) {

  const el = $(id);

  if (el)
    el.classList.remove("hidden");

}


function hideElement(id) {

  const el = $(id);

  if (el)
    el.classList.add("hidden");

}


/* =========================================================
   AUTH UI
========================================================= */

function showAuth(mode = "login") {

  authMode = mode;

  showElement("#authModal");

  if ($("#authTitle"))
    $("#authTitle").textContent =
      mode === "login"
        ? "Welcome Back"
        : "Join ZUNO";

  if ($("#authSubtitle"))
    $("#authSubtitle").textContent =
      mode === "login"
        ? "Login to continue to ZUNO"
        : "Create your ZUNO account";

  if ($("#authSubmitBtn"))
    $("#authSubmitBtn").textContent =
      mode === "login"
        ? "Login"
        : "Create Account";

  if ($("#authSwitchBtn"))
    $("#authSwitchBtn").textContent =
      mode === "login"
        ? "Don't have an account? Sign up"
        : "Already have an account? Login";

  if ($("#authUsername"))
    $("#authUsername")
      .classList.toggle(
        "hidden",
        mode === "login"
      );

  if ($("#authMessage"))
    $("#authMessage").textContent = "";

}


function closeAuth() {

  hideElement("#authModal");

}


function authMessage(text, error = false) {

  const el = $("#authMessage");

  if (!el) return;

  el.textContent = text;

  el.style.color =
    error
      ? "#ff7d8d"
      : "#8ea2ff";
}


/* =========================================================
   SIGNUP
========================================================= */

async function signup() {

  const email =
    safeText($("#authEmail")?.value);

  const password =
    $("#authPassword")?.value || "";

  const newUsername =
    safeText($("#authUsername")?.value)
      .slice(0, 20);

  if (!email || !password || !newUsername) {

    authMessage(
      "Please fill all fields.",
      true
    );

    return;
  }

  if (password.length < 6) {

    authMessage(
      "Password must be at least 6 characters.",
      true
    );

    return;
  }

  if (
    !/^[a-zA-Z0-9_. -]+$/.test(
      newUsername
    )
  ) {

    authMessage(
      "Username can contain letters, numbers, _ . - only.",
      true
    );

    return;
  }

  authMessage("Creating account...");

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.signUp({
        email,
        password
      });

    if (error)
      throw error;

    if (!data.user) {

      authMessage(
        "Account created. Check your email to verify it."
      );

      return;
    }

    const {
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .upsert({
          id: data.user.id,
          username: newUsername
        });

    if (profileError)
      throw profileError;

    username = newUsername;

    localStorage.setItem(
      "zuno_name",
      username
    );

    currentUser = data.user;

    await createXPRow();

    await loadProfile();

    closeAuth();

    updateUserUI();

    await enter(currentRoom);

  } catch (error) {

    console.error(error);

    authMessage(
      error.message || "Signup failed.",
      true
    );

  }

}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

  const email =
    safeText($("#authEmail")?.value);

  const password =
    $("#authPassword")?.value || "";

  if (!email || !password) {

    authMessage(
      "Enter email and password.",
      true
    );

    return;
  }

  authMessage("Logging in...");

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });

    if (error)
      throw error;

    currentUser = data.user;

    await loadProfile();
    await loadXP();

    closeAuth();

    updateUserUI();

  } catch (error) {

    console.error(error);

    authMessage(
      error.message || "Login failed.",
      true
    );

  }

}


/* =========================================================
   PROFILE
========================================================= */

async function loadProfile() {

  if (!currentUser)
    return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "username,bio,avter_url"
      )
      .eq("id", currentUser.id)
      .maybeSingle();

  if (error) {

    console.error(
      "Profile load error:",
      error
    );

    return;
  }

  if (!data)
    return;

  username =
    data.username || username;

  currentProfile = {
    username,
    bio: data.bio || "",
    avatar:
      data.avter_url ||
      defaultAvatar(username)
  };

  localStorage.setItem(
    "zuno_name",
    username
  );

  if ($("#nameInput"))
    $("#nameInput").value =
      username;

  if ($("#profileUsername"))
    $("#profileUsername").value =
      username;

  if ($("#profileBio"))
    $("#profileBio").value =
      data.bio || "";

  if ($("#profileAvatar"))
    $("#profileAvatar").src =
      currentProfile.avatar;

  updateUserUI();

}


function updateUserUI() {

  if (!currentUser) {

    hideElement("#profileBtn");
    hideElement("#logoutBtn");

    return;
  }

  showElement("#profileBtn");
  showElement("#logoutBtn");

  if ($("#nameInput"))
    $("#nameInput").value =
      username;

  if ($("#sideUsername"))
    $("#sideUsername").textContent =
      username;

  loadSideAvatar();

}


async function loadSideAvatar() {

  if (!currentUser)
    return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("avter_url")
      .eq("id", currentUser.id)
      .maybeSingle();

  if (error) {

    console.error(error);

    return;
  }

  const avatar =
    data?.avter_url ||
    defaultAvatar(username);

  currentProfile.avatar = avatar;

  if ($("#sideAvatar")) {

    $("#sideAvatar").innerHTML = `
      <img
        src="${escapeHtml(avatar)}"
        alt=""
      >
    `;

  }

  if ($("#profileAvatar"))
    $("#profileAvatar").src =
      avatar;

}


async function checkAuth() {

  const {
    data
  } =
    await supabaseClient.auth
      .getSession();

  if (data.session) {

    currentUser =
      data.session.user;

    await loadProfile();

    await loadXP();

    updateUserUI();

  } else {

    currentUser = null;

    hideElement("#profileBtn");
    hideElement("#logoutBtn");

  }

}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

  clearHeartbeat();

  await removeOwnOnlineUser();

  removeChannels();

  try {
    await supabaseClient.auth.signOut();
  } catch (error) {
    console.error(error);
  }

  currentUser = null;
  privateUser = null;
  username = "";

  localStorage.removeItem(
    "zuno_name"
  );

  hideElement("#chat");
  hideElement("#feedScreen");
  hideElement("#communitiesScreen");
  hideElement("#peopleScreen");

  showElement("#home");

  hideElement("#profileBtn");
  hideElement("#logoutBtn");

}


/* =========================================================
   ROOMS
========================================================= */

function renderRoom() {

  if ($("#roomTitle")) {

    $("#roomTitle").textContent =
      `${roomIcons[currentRoom] || "💬"} ${currentRoom}`;

  }

  document
    .querySelectorAll(".room")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.room === currentRoom
      );

    });

}


async function loadRoomTopic() {

  if ($("#roomTopic")) {

    $("#roomTopic").textContent =
      defaultTopics[currentRoom] || "";

  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("room_topics")
      .select("topic")
      .eq("room", currentRoom)
      .maybeSingle();

  if (!error && data?.topic) {

    if ($("#roomTopic"))
      $("#roomTopic").textContent =
        data.topic;

  }

}


function openTopicEditor() {

  if ($("#topicRoomName"))
    $("#topicRoomName").textContent =
      currentRoom;

  if ($("#topicInput"))
    $("#topicInput").value =
      $("#roomTopic")?.textContent || "";

  showElement("#topicModal");

}


function closeTopicEditor() {

  hideElement("#topicModal");

}


async function saveRoomTopic() {

  const topic =
    safeText($("#topicInput")?.value);

  if (!topic) {

    alert(
      "Topic cannot be empty."
    );

    return;
  }

  const {
    error
  } =
    await supabaseClient
      .from("room_topics")
      .upsert(
        {
          room: currentRoom,
          topic
        },
        {
          onConflict: "room"
        }
      );

  if (error) {

    alert(
      "Topic save error: " +
      error.message
    );

    return;
  }

  if ($("#roomTopic"))
    $("#roomTopic").textContent =
      topic;

  closeTopicEditor();

}


/* =========================================================
   ONLINE USERS
========================================================= */

async function removeOwnOnlineUser() {

  if (!username)
    return;

  try {

    await supabaseClient
      .from("online_users")
      .delete()
      .eq("username", username);

  } catch (error) {

    console.error(error);

  }

}


async function joinOnlineUsers() {

  if (!username)
    return;

  await removeOwnOnlineUser();

  const {
    data,
    error
  } =
    await supabaseClient
      .from("online_users")
      .insert({
        username,
        room: currentRoom,
        last_seen: Date.now()
      })
      .select()
      .maybeSingle();

  if (error) {

    console.error(
      "Online user error:",
      error
    );

    return;
  }

  onlineUserId =
    data?.id || null;

  await loadOnlineUsers();

}


async function loadOnlineUsers() {

  if (!currentRoom)
    return;

  const cutoff =
    Date.now() - 45000;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("online_users")
      .select(
        "id,username,room,last_seen"
      )
      .eq("room", currentRoom)
      .gt("last_seen", cutoff);

  if (error) {

    console.error(
      "Online load error:",
      error
    );

    return;
  }

  const {
    data: profiles
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "username,avter_url"
      );

  const avatarMap = {};

  (profiles || []).forEach(profile => {

    avatarMap[profile.username] =
      profile.avter_url ||
      defaultAvatar(
        profile.username
      );

  });

  const people =
    $("#people");

  if (!people)
    return;

  people.innerHTML =
    "<h3>Online now</h3>";

  if ($("#onlineCount"))
    $("#onlineCount").textContent =
      data?.length || 0;

  if (!data?.length) {

    people.innerHTML += `
      <div class="empty-state">
        <span>👀</span>
        Nobody else is here.
      </div>
    `;

    return;
  }

  data.forEach(person => {

    const div =
      document.createElement("div");

    div.className =
      person.username === username
        ? "me"
        : "person";

    const avatar =
      avatarMap[person.username] ||
      defaultAvatar(
        person.username
      );

    div.innerHTML = `
      <img
        class="online-avatar"
        src="${escapeHtml(avatar)}"
        alt=""
      >

      <div class="online-user-info">

        <b>
          ${escapeHtml(person.username)}
          ${
            person.username === username
              ? " (you)"
              : ""
          }
        </b>

        <small>
          <span class="online-dot"></span>
          online
        </small>

      </div>
    `;

    if (
      person.username !== username
    ) {

      div.onclick = () =>
        openPrivateChat(
          person.username
        );

    }

    people.appendChild(div);

  });

}


function startHeartbeat() {

  clearHeartbeat();

  heartbeatTimer =
    setInterval(async () => {

      if (!username)
        return;

      await supabaseClient
        .from("online_users")
        .update({
          last_seen: Date.now(),
          room: currentRoom
        })
        .eq("username", username);

      await loadOnlineUsers();

    }, 15000);

}


function clearHeartbeat() {

  if (heartbeatTimer) {

    clearInterval(
      heartbeatTimer
    );

    heartbeatTimer = null;

  }

}


function setupOnlineRealtime() {

  if (onlineChannel) {

    supabaseClient
      .removeChannel(
        onlineChannel
      );

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


/* =========================================================
   ENTER CHAT
========================================================= */

async function enter(
  room = currentRoom
) {

  if (!currentUser) {

    showAuth("login");

    return;
  }

  if (!username)
    await loadProfile();

  currentRoom = room;

  hideElement("#home");
  hideElement("#feedScreen");
  hideElement("#communitiesScreen");
  hideElement("#peopleScreen");

  showElement("#chat");

  renderRoom();

  await loadRoomTopic();

  await joinOnlineUsers();

  startHeartbeat();

  setupOnlineRealtime();

  await renderMessages();

  setupRealtime();

  setupTyping();

}


/* =========================================================
   PUBLIC MESSAGES
========================================================= */

async function renderMessages() {

  const box =
    $("#messages");

  if (!box)
    return;

  box.innerHTML = "";

  displayedMessages.clear();

  const {
    data: profiles
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "username,avter_url"
      );

  const avatarMap = {};

  (profiles || []).forEach(profile => {

    avatarMap[profile.username] =
      profile.avter_url ||
      defaultAvatar(
        profile.username
      );

  });

  const {
    data,
    error
  } =
    await supabaseClient
      .from("messages")
      .select("*")
      .eq("room", currentRoom)
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (error) {

    console.error(
      "Messages error:",
      error
    );

    return;
  }

  if (!data?.length) {

    box.innerHTML = `
      <div class="empty-state">
        <span>💬</span>
        Be the first to say something.
      </div>
    `;

    return;
  }

  data.forEach(message => {

    addMsg(
      message.name,
      message.text,
      message.name === username,
      {
        ...message,
        avatar_url:
          avatarMap[message.name] ||
          defaultAvatar(
            message.name
          )
      }
    );

  });

  box.scrollTop =
    box.scrollHeight;

}


function addMsg(
  name,
  text,
  mine = false,
  message = null
) {

  const key =
    message
      ? `${message.room}|${message.name}|${message.text}|${message.created_at}`
      : `${name}|${text}`;

  if (displayedMessages.has(key))
    return;

  displayedMessages.add(key);

  const box =
    $("#messages");

  if (!box)
    return;

  const empty =
    box.querySelector(
      ".empty-state"
    );

  if (empty)
    empty.remove();

  const div =
    document.createElement("div");

  div.className =
    "msg" +
    (mine ? " mine" : "");

  const avatar =
    message?.avatar_url ||
    defaultAvatar(name);

  div.innerHTML = `
    <div class="msg-user">

      <img
        class="msg-avatar"
        src="${escapeHtml(avatar)}"
        alt=""
      >

      <div class="meta">
        ${escapeHtml(name)}
      </div>

    </div>

    <div class="bubble">
      ${escapeHtml(text)}
    </div>
  `;

  box.appendChild(div);

}


async function send() {

  if (privateUser) {

    await sendPrivate();

    return;
  }

  const input =
    $("#messageInput");

  if (!input)
    return;

  const text =
    input.value.trim();

  if (!text || !username)
    return;

  input.disabled = true;

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .insert({
          room: currentRoom,
          name: username,
          text,
          created_at: Date.now()
        })
        .select()
        .single();

    if (error)
      throw error;

    const {
      data: profile
    } =
      await supabaseClient
        .from("profiles")
        .select("avter_url")
        .eq("username", username)
        .maybeSingle();

    addMsg(
      username,
      text,
      true,
      {
        ...data,
        avatar_url:
          profile?.avter_url ||
          defaultAvatar(username)
      }
    );

    input.value = "";

    await addXP(2);

    const messages =
      $("#messages");

    if (messages)
      messages.scrollTop =
        messages.scrollHeight;

  } catch (error) {

    console.error(error);

    alert(
      "Message send error: " +
      error.message
    );

  } finally {

    input.disabled = false;
    input.focus();

  }

}


/* =========================================================
   PUBLIC REALTIME
========================================================= */

function setupRealtime() {

  if (realtimeChannel) {

    supabaseClient
      .removeChannel(
        realtimeChannel
      );

  }

  realtimeChannel =
    supabaseClient
      .channel(
        "messages-" +
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
        async payload => {

          const message =
            payload.new;

          if (
            message.name === username
          )
            return;

          const {
            data: profile
          } =
            await supabaseClient
              .from("profiles")
              .select("avter_url")
              .eq(
                "username",
                message.name
              )
              .maybeSingle();

          addMsg(
            message.name,
            message.text,
            false,
            {
              ...message,
              avatar_url:
                profile?.avter_url ||
                defaultAvatar(
                  message.name
                )
            }
          );

          const messages =
            $("#messages");

          if (messages)
            messages.scrollTop =
              messages.scrollHeight;

        }
      )
      .subscribe();

}


/* =========================================================
   TYPING
========================================================= */

function setupTyping() {

  if (typingChannel) {

    supabaseClient
      .removeChannel(
        typingChannel
      );

  }

  typingChannel =
    supabaseClient
      .channel(
        "typing-" +
        currentRoom
      );

  typingChannel
    .on(
      "broadcast",
      {
        event: "typing"
      },
      payload => {

        if (
          payload.payload.username ===
          username
        )
          return;

        if ($("#typingIndicator"))
          $("#typingIndicator")
            .textContent =
              `${payload.payload.username} is typing...`;

        clearTimeout(
          typingTimer
        );

        typingTimer =
          setTimeout(() => {

            if ($("#typingIndicator"))
              $("#typingIndicator")
                .textContent = "";

          }, 1500);

      }
    )
    .subscribe();

}


async function broadcastTyping() {

  if (
    !typingChannel ||
    !username ||
    privateUser
  )
    return;

  await typingChannel.send({
    type: "broadcast",
    event: "typing",
    payload: {
      username
    }
  });

}


/* =========================================================
   PRIVATE CHAT
========================================================= */

async function openPrivateChat(user) {

  if (!user || user === username)
    return;

  privateUser = user;

  hideElement("#publicChat");
  showElement("#privateChat");

  if ($("#people"))
    $("#people")
      .classList.remove("show");

  if ($("#privateUserName"))
    $("#privateUserName")
      .textContent = user;

  if ($("#messageInput"))
    $("#messageInput")
      .placeholder =
        `Message ${user}...`;

  await renderPrivateMessages();

  setupPrivateRealtime();

}


async function renderPrivateMessages() {

  const box =
    $("#privateMessages");

  if (!box)
    return;

  box.innerHTML = "";

  displayedPrivateMessages.clear();

  const {
    data,
    error
  } =
    await supabaseClient
      .from("private_messages")
      .select("*")
      .or(
        `and(sender.eq.${username},receiver.eq.${privateUser}),and(sender.eq.${privateUser},receiver.eq.${username})`
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (error) {

    console.error(
      "Private messages error:",
      error
    );

    return;
  }

  (data || []).forEach(
    message =>
      addPrivateMsg(message)
  );

  box.scrollTop =
    box.scrollHeight;

}


function addPrivateMsg(message) {

  const key =
    `${message.sender}|${message.receiver}|${message.text}|${message.created_at}`;

  if (
    displayedPrivateMessages.has(key)
  )
    return;

  displayedPrivateMessages.add(key);

  const box =
    $("#privateMessages");

  if (!box)
    return;

  const div =
    document.createElement("div");

  const mine =
    message.sender === username;

  div.className =
    "msg" +
    (mine ? " mine" : "");

  div.innerHTML = `
    <div class="msg-user">

      <img
        class="msg-avatar"
        src="${escapeHtml(
          defaultAvatar(
            message.sender
          )
        )}"
        alt=""
      >

      <div class="meta">
        ${escapeHtml(
          message.sender
        )}
      </div>

    </div>

    <div class="bubble">
      ${escapeHtml(message.text)}
    </div>
  `;

  box.appendChild(div);

}


async function sendPrivate() {

  if (!privateUser)
    return;

  const input =
    $("#messageInput");

  if (!input)
    return;

  const text =
    input.value.trim();

  if (!text)
    return;

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("private_messages")
        .insert({
          sender: username,
          receiver: privateUser,
          text,
          created_at: Date.now()
        })
        .select()
        .single();

    if (error)
      throw error;

    addPrivateMsg(data);

    input.value = "";

    await addXP(3);

    const box =
      $("#privateMessages");

    if (box)
      box.scrollTop =
        box.scrollHeight;

  } catch (error) {

    console.error(error);

    alert(
      "Private message error: " +
      error.message
    );

  }

}


function setupPrivateRealtime() {

  if (privateChannel) {

    supabaseClient
      .removeChannel(
        privateChannel
      );

  }

  privateChannel =
    supabaseClient
      .channel(
        "private-" +
        Date.now()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages"
        },
        payload => {

          const message =
            payload.new;

          const valid =
            (
              message.sender === username &&
              message.receiver === privateUser
            ) ||
            (
              message.sender === privateUser &&
              message.receiver === username
            );

          if (!valid)
            return;

          if (
            message.sender === username
          )
            return;

          addPrivateMsg(message);

          const box =
            $("#privateMessages");

          if (box)
            box.scrollTop =
              box.scrollHeight;

        }
      )
      .subscribe();

}


/* =========================================================
   CLOSE PRIVATE CHAT
========================================================= */

function closePrivateChat() {

  privateUser = null;

  hideElement("#privateChat");
  showElement("#publicChat");

  if ($("#messageInput"))
    $("#messageInput")
      .placeholder =
        "Write something...";

  if (privateChannel) {

    supabaseClient
      .removeChannel(
        privateChannel
      );

    privateChannel = null;

  }

}


/* =========================================================
   XP + LEVEL
========================================================= */

function getLevel(xp) {

  return Math.floor(
    Number(xp || 0) / 100
  ) + 1;

}


async function createXPRow() {

  if (!currentUser)
    return;

  const {
    error
  } =
    await supabaseClient
      .from("user_xp")
      .upsert({
        user_id: currentUser.id,
        xp: 0,
        level: 1
      });

  if (error)
    console.error(
      "XP row error:",
      error
    );

}


async function loadXP() {

  if (!currentUser)
    return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("user_xp")
      .select("xp,level")
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();

  if (error) {

    console.error(
      "XP load error:",
      error
    );

    return;
  }

  if (!data) {

    await createXPRow();

    currentXP = 0;
    currentLevel = 1;

  } else {

    currentXP =
      Number(data.xp || 0);

    currentLevel =
      Number(data.level || 1);

  }

  updateLevel();

}


async function addXP(amount) {

  if (!currentUser)
    return;

  const oldXP =
    currentXP;

  const oldLevel =
    getLevel(oldXP);

  const newXP =
    oldXP + Number(amount || 0);

  const newLevel =
    getLevel(newXP);

  const {
    error
  } =
    await supabaseClient
      .from("user_xp")
      .upsert({
        user_id: currentUser.id,
        xp: newXP,
        level: newLevel,
        updated_at:
          new Date().toISOString()
      });

  if (error) {

    console.error(
      "XP update error:",
      error
    );

    return;
  }

  currentXP = newXP;
  currentLevel = newLevel;

  showXP(
    `⭐ +${amount} XP`
  );

  updateLevel();

  if (newLevel > oldLevel) {

    setTimeout(() => {

      alert(
        `🎉 Level Up!\n\nYou reached Level ${newLevel}!`
      );

    }, 250);

    await checkLevelBadge(
      newLevel
    );

  }

}


function updateLevel() {

  const level =
    getLevel(currentXP);

  currentLevel =
    level;

  if ($("#sideLevel"))
    $("#sideLevel").textContent =
      `Level ${level}`;

}


function showXP(text) {

  const toast =
    $("#xpToast");

  if (!toast)
    return;

  toast.textContent =
    text;

  toast.classList.remove(
    "hidden"
  );

  setTimeout(() => {

    toast.classList.add(
      "hidden"
    );

  }, 1200);

}


async function checkLevelBadge(level) {

  if (!currentUser)
    return;

  if (level < 10)
    return;

  const {
    data: badge
  } =
    await supabaseClient
      .from("badges")
      .select("id")
      .eq("name", "Legend")
      .maybeSingle();

  if (!badge)
    return;

  await supabaseClient
    .from("user_badges")
    .upsert({
      user_id: currentUser.id,
      badge_id: badge.id
    });

}


/* =========================================================
   PROFILE MODAL
========================================================= */

async function openProfile() {

  if (!currentUser) {

    showAuth("login");

    return;
  }

  await loadProfile();

  showElement("#profileModal");

}


function closeProfile() {

  hideElement("#profileModal");

  if ($("#profileMessage"))
    $("#profileMessage")
      .textContent = "";

}


async function uploadAvatar() {

  const file =
    $("#avatarInput")?.files?.[0];

  if (!file)
    return null;

  if (
    file.size >
    5 * 1024 * 1024
  ) {

    throw new Error(
      "Image must be under 5MB."
    );

  }

  const extension =
    file.name
      .split(".")
      .pop()
      .toLowerCase();

  const path =
    `${currentUser.id}/avatar.${extension}`;

  const {
    error
  } =
    await supabaseClient.storage
      .from("avatars")
      .upload(
        path,
        file,
        {
          upsert: true,
          contentType: file.type
        }
      );

  if (error)
    throw error;

  const {
    data
  } =
    supabaseClient.storage
      .from("avatars")
      .getPublicUrl(path);

  return (
    data.publicUrl +
    "?t=" +
    Date.now()
  );

}


async function saveProfile() {

  if (!currentUser)
    return;

  const newName =
    safeText(
      $("#profileUsername")?.value
    )
      .slice(0, 20);

  const bio =
    safeText(
      $("#profileBio")?.value
    )
      .slice(0, 120);

  if (newName.length < 3) {

    if ($("#profileMessage"))
      $("#profileMessage")
        .textContent =
          "Username must be at least 3 characters.";

    return;
  }

  if (
    !/^[a-zA-Z0-9_. -]+$/.test(
      newName
    )
  ) {

    if ($("#profileMessage"))
      $("#profileMessage")
        .textContent =
          "Username contains invalid characters.";

    return;
  }

  if ($("#profileMessage"))
    $("#profileMessage")
      .textContent =
        "Saving...";

  try {

    let avatarUrl = null;

    if (
      $("#avatarInput")?.files?.length
    ) {

      avatarUrl =
        await uploadAvatar();

    }

    const updateData = {
      username: newName,
      bio
    };

    if (avatarUrl)
      updateData.avter_url =
        avatarUrl;

    const {
      error
    } =
      await supabaseClient
        .from("profiles")
        .update(updateData)
        .eq(
          "id",
          currentUser.id
        );

    if (error)
      throw error;

    username =
      newName;

    localStorage.setItem(
      "zuno_name",
      username
    );

    await loadProfile();

    await loadSideAvatar();

    await loadOnlineUsers();

    if ($("#profileMessage"))
      $("#profileMessage")
        .textContent =
          "✓ Profile updated!";

    setTimeout(
      closeProfile,
      700
    );

  } catch (error) {

    console.error(error);

    if ($("#profileMessage"))
      $("#profileMessage")
        .textContent =
          error.message ||
          "Profile update failed.";

  }

           }

/* =========================================================
   FEED
========================================================= */

function openFeed() {

  if (!currentUser) {

    showAuth("login");

    return;
  }

  hideElement("#home");
  hideElement("#chat");
  hideElement("#communitiesScreen");
  hideElement("#peopleScreen");

  showElement("#feedScreen");

  loadFeed();

}


async function loadFeed() {

  const feed =
    $("#postFeed");

  if (!feed)
    return;

  feed.innerHTML = `
    <div class="empty-state">
      <span>⏳</span>
      Loading ZUNO Feed...
    </div>
  `;

  const {
    data: posts,
    error
  } =
    await supabaseClient
      .from("posts")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(50);

  if (error) {

    console.error(
      "Feed error:",
      error
    );

    feed.innerHTML = `
      <div class="empty-state">
        <span>⚠️</span>
        Unable to load feed.
      </div>
    `;

    return;
  }

  if (!posts?.length) {

    feed.innerHTML = `
      <div class="empty-state">
        <span>✨</span>
        No posts yet. Be the first creator!
      </div>
    `;

    return;
  }

  currentFeedPosts =
    posts;

  const userIds =
    [...new Set(
      posts.map(
        post => post.user_id
      )
    )];

  const {
    data: profiles
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id,username,avter_url,bio"
      )
      .in(
        "id",
        userIds
      );

  const profileMap = {};

  (profiles || []).forEach(profile => {

    profileMap[profile.id] =
      profile;

  });

  const postIds =
    posts.map(
      post => post.id
    );

  const {
    data: likes
  } =
    await supabaseClient
      .from("post_likes")
      .select(
        "post_id,user_id"
      )
      .in(
        "post_id",
        postIds
      );

  const {
    data: comments
  } =
    await supabaseClient
      .from("comments")
      .select(
        "id,post_id,user_id,content,created_at"
      )
      .in(
        "post_id",
        postIds
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  const likeMap = {};
  const commentMap = {};

  (likes || []).forEach(like => {

    if (!likeMap[like.post_id])
      likeMap[like.post_id] = [];

    likeMap[like.post_id].push(
      like
    );

  });

  (comments || []).forEach(comment => {

    if (!commentMap[comment.post_id])
      commentMap[comment.post_id] = [];

    commentMap[comment.post_id].push(
      comment
    );

  });

  feed.innerHTML = "";

  posts.forEach(post => {

    renderPost(
      post,
      profileMap[post.user_id],
      likeMap[post.id] || [],
      commentMap[post.id] || []
    );

  });

}


function renderPost(
  post,
  profile,
  likes,
  comments
) {

  const feed =
    $("#postFeed");

  if (!feed)
    return;

  const div =
    document.createElement("article");

  div.className =
    "zuno-post";

  const avatar =
    profile?.avter_url ||
    defaultAvatar(
      profile?.username ||
      "ZUNO"
    );

  const liked =
    likes.some(
      like =>
        like.user_id ===
        currentUser?.id
    );

  const author =
    profile?.username ||
    "ZUNO User";

  let commentsHtml = "";

  comments.slice(-3).forEach(comment => {

    commentsHtml += `
      <div class="post-comment">
        <b>
          ${escapeHtml(
            comment.user_id ===
            currentUser?.id
              ? username
              : "User"
          )}
        </b>
        ${escapeHtml(
          comment.content
        )}
      </div>
    `;

  });

  div.innerHTML = `
    <div class="post-header">

      <img
        class="msg-avatar"
        src="${escapeHtml(avatar)}"
        alt=""
      >

      <div>
        <b>
          ${escapeHtml(author)}
        </b>

        <small>
          ${formatDate(post.created_at)}
        </small>
      </div>

    </div>

    <div class="post-content">
      ${escapeHtml(post.content)}
    </div>

    <div class="post-actions">

      <button
        class="post-like-btn"
        data-id="${post.id}"
      >
        ${liked ? "❤️" : "🤍"}
        ${likes.length}
      </button>

      <button
        class="post-comment-btn"
        data-id="${post.id}"
      >
        💬 ${comments.length}
      </button>

      <button
        class="post-share-btn"
        data-id="${post.id}"
      >
        ↗️ Share
      </button>

    </div>

    <div class="post-comments">
      ${commentsHtml}
    </div>
  `;

  const likeBtn =
    div.querySelector(
      ".post-like-btn"
    );

  if (likeBtn) {

    likeBtn.onclick = () =>
      toggleLike(
        post.id,
        likes,
        likeBtn
      );

  }

  const commentBtn =
    div.querySelector(
      ".post-comment-btn"
    );

  if (commentBtn) {

    commentBtn.onclick = () =>
      addComment(
        post.id
      );

  }

  const shareBtn =
    div.querySelector(
      ".post-share-btn"
    );

  if (shareBtn) {

    shareBtn.onclick = () =>
      sharePost(
        post.content
      );

  }

  feed.appendChild(div);

}


/* =========================================================
   CREATE POST
========================================================= */

async function createPost() {

  if (!currentUser) {

    showAuth("login");

    return;
  }

  const input =
    $("#postInput");

  if (!input)
    return;

  const content =
    input.value.trim();

  if (!content) {

    alert(
      "Write something first."
    );

    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("posts")
      .insert({
        user_id:
          currentUser.id,
        content
      })
      .select()
      .single();

  if (error) {

    console.error(error);

    alert(
      "Post error: " +
      error.message
    );

    return;
  }

  input.value = "";

  await addXP(10);

  await createCreatorBadge();

  await loadFeed();

}


async function createCreatorBadge() {

  if (!currentUser)
    return;

  const {
    data: badge
  } =
    await supabaseClient
      .from("badges")
      .select("id")
      .eq(
        "name",
        "Creator"
      )
      .maybeSingle();

  if (!badge)
    return;

  await supabaseClient
    .from("user_badges")
    .upsert({
      user_id:
        currentUser.id,
      badge_id:
        badge.id
    });

}


/* =========================================================
   LIKES
========================================================= */

async function toggleLike(
  postId,
  likes,
  button
) {

  if (!currentUser)
    return;

  const existing =
    likes.find(
      like =>
        like.user_id ===
        currentUser.id
    );

  if (existing) {

    const {
      error
    } =
      await supabaseClient
        .from("post_likes")
        .delete()
        .eq(
          "post_id",
          postId
        )
        .eq(
          "user_id",
          currentUser.id
        );

    if (error) {

      console.error(error);

      return;
    }

  } else {

    const {
      error
    } =
      await supabaseClient
        .from("post_likes")
        .insert({
          post_id:
            postId,
          user_id:
            currentUser.id
        });

    if (error) {

      console.error(error);

      return;
    }

    await addXP(1);

  }

  await loadFeed();

}


/* =========================================================
   COMMENTS
========================================================= */

async function addComment(postId) {

  if (!currentUser)
    return;

  const content =
    prompt(
      "Write your comment:"
    );

  if (!content?.trim())
    return;

  const {
    error
  } =
    await supabaseClient
      .from("comments")
      .insert({
        post_id:
          postId,
        user_id:
          currentUser.id,
        content:
          content.trim()
      });

  if (error) {

    alert(
      "Comment error: " +
      error.message
    );

    return;
  }

  await addXP(3);

  await loadFeed();

}


async function sharePost(text) {

  try {

    if (
      navigator.clipboard
    ) {

      await navigator.clipboard
        .writeText(text);

      showXP(
        "📋 Copied!"
      );

      return;
    }

  } catch (error) {

    console.error(error);

  }

  alert(text);

}


/* =========================================================
   POLLS
========================================================= */

function togglePollCreator() {

  const creator =
    $("#pollCreator");

  if (!creator)
    return;

  creator.classList.toggle(
    "hidden"
  );

}


async function createPoll() {

  if (!currentUser)
    return;

  const question =
    safeText(
      $("#pollQuestion")?.value
    );

  const optionInputs =
    document.querySelectorAll(
      ".poll-option"
    );

  const options =
    [...optionInputs]
      .map(
        input =>
          input.value.trim()
      )
      .filter(Boolean)
      .slice(0, 4);

  if (!question) {

    alert(
      "Enter a poll question."
    );

    return;
  }

  if (options.length < 2) {

    alert(
      "Add at least 2 options."
    );

    return;
  }

  try {

    const {
      data: post,
      error: postError
    } =
      await supabaseClient
        .from("posts")
        .insert({
          user_id:
            currentUser.id,
          content:
            question
        })
        .select()
        .single();

    if (postError)
      throw postError;

    const {
      data: poll,
      error: pollError
    } =
      await supabaseClient
        .from("polls")
        .insert({
          post_id:
            post.id,
          question
        })
        .select()
        .single();

    if (pollError)
      throw pollError;

    const rows =
      options.map(
        option => ({
          poll_id:
            poll.id,
          option_text:
            option,
          votes: 0
        })
      );

    const {
      error: optionError
    } =
      await supabaseClient
        .from("poll_options")
        .insert(rows);

    if (optionError)
      throw optionError;

    if ($("#pollQuestion"))
      $("#pollQuestion").value = "";

    optionInputs.forEach(
      input =>
        input.value = ""
    );

    hideElement("#pollCreator");

    await addXP(15);

    await loadFeed();

  } catch (error) {

    console.error(error);

    alert(
      "Poll creation error: " +
      error.message
    );

  }

}


/* =========================================================
   POLL VOTING
========================================================= */

async function votePoll(
  pollId,
  optionId
) {

  if (!currentUser)
    return;

  const {
    error
  } =
    await supabaseClient
      .from("poll_votes")
      .insert({
        poll_id:
          pollId,
        option_id:
          optionId,
        user_id:
          currentUser.id
      });

  if (error) {

    if (
      error.code === "23505"
    ) {

      alert(
        "You already voted in this poll."
      );

    } else {

      alert(
        "Vote error: " +
        error.message
      );

    }

    return;
  }

  await addXP(2);

  await loadFeed();

}


/* =========================================================
   COMMUNITIES
========================================================= */

function openCommunities() {

  if (!currentUser) {

    showAuth("login");

    return;
  }

  hideElement("#home");
  hideElement("#chat");
  hideElement("#feedScreen");
  hideElement("#peopleScreen");

  showElement("#communitiesScreen");

  loadCommunities();

}


async function loadCommunities(
  search = ""
) {

  const list =
    $("#communityList");

  if (!list)
    return;

  list.innerHTML = `
    <div class="empty-state">
      <span>⏳</span>
      Loading communities...
    </div>
  `;

  let query =
    supabaseClient
      .from("communities")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (search) {

    query =
      query.ilike(
        "name",
        `%${search}%`
      );

  }

  const {
    data,
    error
  } =
    await query;

  if (error) {

    console.error(error);

    list.innerHTML = `
      <div class="empty-state">
        <span>⚠️</span>
        Failed to load communities.
      </div>
    `;

    return;
  }

  currentCommunities =
    data || [];

  list.innerHTML = "";

  if (!data?.length) {

    list.innerHTML = `
      <div class="empty-state">
        <span>🌐</span>
        No communities found.
      </div>
    `;

    return;
  }

  data.forEach(
    community =>
      renderCommunity(
        community
      )
  );

}


function renderCommunity(
  community
) {

  const list =
    $("#communityList");

  if (!list)
    return;

  const card =
    document.createElement("div");

  card.className =
    "community-card";

  card.innerHTML = `
    <div class="community-icon">
      ${escapeHtml(
        community.icon ||
        "🌐"
      )}
    </div>

    <div class="community-info">

      <h3>
        ${escapeHtml(
          community.name
        )}
      </h3>

      <p>
        ${escapeHtml(
          community.description ||
          "A ZUNO community."
        )}
      </p>

    </div>

    <button
      class="secondary-btn community-join"
    >
      Join
    </button>
  `;

  const button =
    card.querySelector(
      ".community-join"
    );

  if (button) {

    button.onclick = () =>
      joinCommunity(
        community.id,
        button
      );

  }

  list.appendChild(card);

}


async function createCommunity() {

  if (!currentUser)
    return;

  const name =
    safeText(
      $("#communityName")?.value
    )
      .slice(0, 40);

  const description =
    safeText(
      $("#communityDescription")?.value
    )
      .slice(0, 180);

  const icon =
    safeText(
      $("#communityIcon")?.value,
      "🌐"
    )
      .slice(0, 4);

  if (name.length < 2) {

    alert(
      "Community name is too short."
    );

    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("communities")
      .insert({
        name,
        description,
        icon,
        owner_id:
          currentUser.id
      })
      .select()
      .single();

  if (error) {

    alert(
      "Community error: " +
      error.message
    );

    return;
  }

  await supabaseClient
    .from("community_members")
    .insert({
      community_id:
        data.id,
      user_id:
        currentUser.id,
      role:
        "owner"
    });

  await addXP(20);

  hideElement(
    "#communityModal"
  );

  if ($("#communityName"))
    $("#communityName").value = "";

  if ($("#communityDescription"))
    $("#communityDescription").value = "";

  await loadCommunities();

}


async function joinCommunity(
  communityId,
  button
) {

  if (!currentUser)
    return;

  const {
    error
  } =
    await supabaseClient
      .from("community_members")
      .upsert({
        community_id:
          communityId,
        user_id:
          currentUser.id,
        role:
          "member"
      });

  if (error) {

    alert(
      "Join error: " +
      error.message
    );

    return;
  }

  if (button) {

    button.textContent =
      "Joined ✓";

    button.disabled =
      true;

  }

  await addXP(5);

       }

/* =========================================================
   PEOPLE DISCOVERY
========================================================= */

function openPeople() {

  if (!currentUser) {

    showAuth("login");

    return;
  }

  hideElement("#home");
  hideElement("#chat");
  hideElement("#feedScreen");
  hideElement("#communitiesScreen");

  showElement("#peopleScreen");

  loadPeople();

}


async function loadPeople(
  search = ""
) {

  const list =
    $("#discoverPeopleList");

  if (!list)
    return;

  list.innerHTML = `
    <div class="empty-state">
      <span>⏳</span>
      Finding people...
    </div>
  `;

  let query =
    supabaseClient
      .from("profiles")
      .select(
        "id,username,bio,avter_url"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(50);

  if (search) {

    query =
      query.ilike(
        "username",
        `%${search}%`
      );

  }

  const {
    data,
    error
  } =
    await query;

  if (error) {

    console.error(error);

    return;
  }

  list.innerHTML = "";

  const people =
    (data || [])
      .filter(
        person =>
          person.id !==
          currentUser.id
      );

  if (!people.length) {

    list.innerHTML = `
      <div class="empty-state">
        <span>👀</span>
        No people found.
      </div>
    `;

    return;
  }

  people.forEach(
    person => {

      const div =
        document.createElement(
          "div"
        );

      div.className =
        "person";

      const avatar =
        person.avter_url ||
        defaultAvatar(
          person.username
        );

      div.innerHTML = `
        <img
          class="online-avatar"
          src="${escapeHtml(avatar)}"
          alt=""
        >

        <div class="online-user-info">

          <b>
            ${escapeHtml(
              person.username
            )}
          </b>

          <small>
            ${escapeHtml(
              person.bio ||
              "ZUNO member"
            )}
          </small>

        </div>

        <button
          class="secondary-btn"
        >
          Chat
        </button>
      `;

      const btn =
        div.querySelector(
          "button"
        );

      if (btn) {

        btn.onclick = () =>
          openPrivateChatFromPeople(
            person.username
          );

      }

      list.appendChild(div);

    }
  );

}


async function openPrivateChatFromPeople(
  person
) {

  hideElement("#peopleScreen");

  showElement("#chat");

  currentRoom =
    currentRoom ||
    "Chill Zone";

  renderRoom();

  await loadRoomTopic();

  await joinOnlineUsers();

  await renderMessages();

  setupRealtime();

  setupTyping();

  await openPrivateChat(
    person
  );

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function loadNotifications() {

  if (!currentUser)
    return;

  const list =
    $("#notificationList");

  if (!list)
    return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("notifications")
      .select("*")
      .eq(
        "user_id",
        currentUser.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(30);

  if (error) {

    console.error(
      "Notifications error:",
      error
    );

    return;
  }

  list.innerHTML = "";

  if (!data?.length) {

    list.innerHTML = `
      <div class="empty-state">
        <span>🔔</span>
        No notifications yet.
      </div>
    `;

    updateNotificationBadge(
      0
    );

    return;
  }

  const unread =
    data.filter(
      item =>
        !item.is_read
    ).length;

  updateNotificationBadge(
    unread
  );

  data.forEach(item => {

    const div =
      document.createElement(
        "div"
      );

    div.className =
      "notification-item";

    div.innerHTML = `
      <b>
        ${escapeHtml(
          item.message
        )}
      </b>

      <small>
        ${formatDate(
          item.created_at
        )}
      </small>
    `;

    list.appendChild(div);

  });

}


function updateNotificationBadge(
  count
) {

  const badge =
    $("#notificationBadge");

  if (!badge)
    return;

  badge.textContent =
    count > 99
      ? "99+"
      : String(count);

  badge.classList.toggle(
    "hidden",
    count <= 0
  );

}


async function markNotificationsRead() {

  if (!currentUser)
    return;

  await supabaseClient
    .from("notifications")
    .update({
      is_read: true
    })
    .eq(
      "user_id",
      currentUser.id
    )
    .eq(
      "is_read",
      false
    );

  updateNotificationBadge(
    0
  );

}


/* =========================================================
   BADGES
========================================================= */

async function loadBadges() {

  if (!currentUser)
    return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("user_badges")
      .select(
        "earned_at,badges(name,description,icon)"
      )
      .eq(
        "user_id",
        currentUser.id
      )
      .order(
        "earned_at",
        {
          ascending: false
        }
      );

  if (error) {

    console.error(
      "Badges error:",
      error
    );

    return;
  }

  console.log(
    "ZUNO badges:",
    data
  );

}


/* =========================================================
   CHANNEL CLEANUP
========================================================= */

function removeChannels() {

  const channels = [
    realtimeChannel,
    privateChannel,
    onlineChannel,
    typingChannel
  ];

  channels.forEach(
    channel => {

      if (channel) {

        supabaseClient
          .removeChannel(
            channel
          );

      }

    }
  );

  realtimeChannel = null;
  privateChannel = null;
  onlineChannel = null;
  typingChannel = null;

}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {

  const theme =
    localStorage.getItem(
      "zuno_theme"
    ) ||
    localStorage.getItem(
      "vibechat_theme"
    );

  if (theme === "light") {

    document.body
      .classList.add(
        "light"
      );

    if ($("#themeBtn"))
      $("#themeBtn").textContent =
        "☀";

  } else {

    document.body
      .classList.remove(
        "light"
      );

    if ($("#themeBtn"))
      $("#themeBtn").textContent =
        "☾";

  }

}


function toggleTheme() {

  const light =
    document.body
      .classList.toggle(
        "light"
      );

  localStorage.setItem(
    "zuno_theme",
    light
      ? "light"
      : "dark"
  );

  if ($("#themeBtn"))
    $("#themeBtn").textContent =
      light
        ? "☀"
        : "☾";

}


/* =========================================================
   NAVIGATION
========================================================= */

function goHome() {

  clearHeartbeat();

  removeOwnOnlineUser();

  hideElement("#chat");
  hideElement("#feedScreen");
  hideElement("#communitiesScreen");
  hideElement("#peopleScreen");

  showElement("#home");

}


function closeAllScreens() {

  hideElement("#chat");
  hideElement("#feedScreen");
  hideElement("#communitiesScreen");
  hideElement("#peopleScreen");

}


/* =========================================================
   EVENTS — AUTH
========================================================= */

$("#joinBtn")?.addEventListener(
  "click",
  () => {

    if (currentUser)
      enter(currentRoom);
    else
      showAuth("login");

  }
);


$("#nameInput")?.addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {

      if (currentUser)
        enter(currentRoom);
      else
        showAuth("login");

    }

  }
);


$("#closeAuthBtn")?.addEventListener(
  "click",
  closeAuth
);


$("#authSwitchBtn")?.addEventListener(
  "click",
  () => {

    showAuth(
      authMode === "login"
        ? "signup"
        : "login"
    );

  }
);


$("#authSubmitBtn")?.addEventListener(
  "click",
  () => {

    if (authMode === "login")
      login();
    else
      signup();

  }
);


$("#authPassword")?.addEventListener(
  "keydown",
  e => {

    if (e.key === "Enter") {

      if (authMode === "login")
        login();
      else
        signup();

    }

  }
);


/* =========================================================
   EVENTS — ROOMS
========================================================= */

document
  .querySelectorAll(".roomcard")
  .forEach(card => {

    card.addEventListener(
      "click",
      () =>
        enter(
          card.dataset.room
        )
    );

  });


document
  .querySelectorAll(".room")
  .forEach(button => {

    button.addEventListener(
      "click",
      async () => {

        if (!currentUser) {

          showAuth("login");

          return;
        }

        closePrivateChat();

        currentRoom =
          button.dataset.room;

        renderRoom();

        await joinOnlineUsers();

        await loadRoomTopic();

        await renderMessages();

        setupRealtime();

        setupTyping();

      }
    );

  });


/* =========================================================
   EVENTS — CHAT
========================================================= */

$("#sendBtn")?.addEventListener(
  "click",
  send
);


$("#messageInput")?.addEventListener(
  "keydown",
  e => {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault();

      send();

    }

  }
);


$("#messageInput")?.addEventListener(
  "input",
  broadcastTyping
);


$("#emojiBtn")?.addEventListener(
  "click",
  () => {

    $("#emojiPanel")
      ?.classList.toggle(
        "hidden"
      );

  }
);


document
  .querySelectorAll(
    "#emojiPanel button"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const input =
          $("#messageInput");

        if (!input)
          return;

        input.value +=
          button.textContent;

        input.focus();

      }
    );

  });


$("#usersBtn")?.addEventListener(
  "click",
  () => {

    $("#people")
      ?.classList.toggle(
        "show"
      );

  }
);


$("#privateBackBtn")?.addEventListener(
  "click",
  closePrivateChat
);


$("#backBtn")?.addEventListener(
  "click",
  goHome
);


/* =========================================================
   EVENTS — TOPBAR
========================================================= */

$("#themeBtn")?.addEventListener(
  "click",
  toggleTheme
);


$("#profileBtn")?.addEventListener(
  "click",
  openProfile
);


$("#closeProfileBtn")?.addEventListener(
  "click",
  closeProfile
);


$("#saveProfileBtn")?.addEventListener(
  "click",
  saveProfile
);


$("#logoutBtn")?.addEventListener(
  "click",
  logout
);


$("#notificationBtn")?.addEventListener(
  "click",
  async () => {

    showElement(
      "#notificationModal"
    );

    await loadNotifications();

    await markNotificationsRead();

  }
);


$("#closeNotificationBtn")?.addEventListener(
  "click",
  () =>
    hideElement(
      "#notificationModal"
    )
);

/* =========================================================
   EVENTS — PROFILE AVATAR
========================================================= */

$("#avatarInput")?.addEventListener(
  "change",
  () => {

    const file =
      $("#avatarInput")
        ?.files?.[0];

    if (!file)
      return;

    const reader =
      new FileReader();

    reader.onload =
      e => {

        if ($("#profileAvatar"))
          $("#profileAvatar")
            .src =
              e.target.result;

      };

    reader.readAsDataURL(
      file
    );

  }
);


/* =========================================================
   EVENTS — TOPIC
========================================================= */

$("#editTopicBtn")?.addEventListener(
  "click",
  openTopicEditor
);


$("#closeTopicBtn")?.addEventListener(
  "click",
  closeTopicEditor
);


$("#cancelTopicBtn")?.addEventListener(
  "click",
  closeTopicEditor
);


$("#saveTopicBtn")?.addEventListener(
  "click",
  saveRoomTopic
);


/* =========================================================
   EVENTS — FEED
========================================================= */

$("#openFeedBtn")?.addEventListener(
  "click",
  openFeed
);


$("#feedBackBtn")?.addEventListener(
  "click",
  goHome
);


$("#createPostBtn")?.addEventListener(
  "click",
  createPost
);


$("#pollBtn")?.addEventListener(
  "click",
  togglePollCreator
);


/* =========================================================
   EVENTS — COMMUNITIES
========================================================= */

$("#openCommunitiesBtn")?.addEventListener(
  "click",
  openCommunities
);


$("#communitiesBackBtn")?.addEventListener(
  "click",
  goHome
);


$("#createCommunityBtn")?.addEventListener(
  "click",
  () =>
    showElement(
      "#communityModal"
    )
);


$("#closeCommunityBtn")?.addEventListener(
  "click",
  () =>
    hideElement(
      "#communityModal"
    )
);


$("#cancelCommunityBtn")?.addEventListener(
  "click",
  () =>
    hideElement(
      "#communityModal"
    )
);


$("#saveCommunityBtn")?.addEventListener(
  "click",
  createCommunity
);


$("#communitySearch")?.addEventListener(
  "input",
  e =>
    loadCommunities(
      e.target.value.trim()
    )
);


/* =========================================================
   EVENTS — PEOPLE
========================================================= */

$("#openPeopleBtn")?.addEventListener(
  "click",
  openPeople
);


$("#peopleBackBtn")?.addEventListener(
  "click",
  goHome
);


$("#peopleSearch")?.addEventListener(
  "input",
  e =>
    loadPeople(
      e.target.value.trim()
    )
);


/* =========================================================
   AUTH STATE CHANGES
========================================================= */

supabaseClient.auth.onAuthStateChange(
  async (event, session) => {

    if (session?.user) {

      currentUser =
        session.user;

      await loadProfile();

      await loadXP();

      updateUserUI();

    }

  }
);


/* =========================================================
   START ZUNO
========================================================= */

(async function startZuno() {

  try {

    renderRoom();

    loadTheme();

    await checkAuth();

    if (currentUser) {

      await loadXP();

      await loadNotifications();

      await loadBadges();

    }

  } catch (error) {

    console.error(
      "ZUNO startup error:",
      error
    );

  }

})();

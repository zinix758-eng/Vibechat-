const $ = s => document.querySelector(s);


/* =========================
   SUPABASE
========================= */

const SUPABASE_URL =
  "https://uopwsaymtomnxfmacsnu.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_z6vlfZ8IsWgM4clPEWIavA_YBV4GlQ2";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* =========================
   STATE
========================= */

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


const roomIcons = {
  "Chill Zone":"🌙",
  "Music Lounge":"🎵",
  "Gaming":"🎮",
  "Random":"💭"
};


const defaultTopics = {
  "Chill Zone":"Talk • Chill • Make new friends",
  "Music Lounge":"Music • Songs • Vibes",
  "Gaming":"Gaming • Fun • Squad",
  "Random":"Random talks • Anything goes"
};


/* =========================
   SAFE HTML
========================= */

function escapeHtml(value){

  return String(value ?? "")
    .replace(/[&<>"']/g, c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[c]));

}


/* =========================
   AVATAR
========================= */

function defaultAvatar(name){

  const letter =
    String(name || "?")
      .trim()
      .charAt(0)
      .toUpperCase() || "?";

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(letter)}&background=667eea&color=fff&size=200`;

}


/* =========================
   AUTH UI
========================= */

function showAuth(mode="login"){

  authMode = mode;

  $("#authModal").classList.remove("hidden");

  $("#authTitle").textContent =
    mode === "login"
      ? "Welcome Back"
      : "Join ZUNO";

  $("#authSubtitle").textContent =
    mode === "login"
      ? "Login to continue to ZUNO"
      : "Create your ZUNO account";

  $("#authSubmitBtn").textContent =
    mode === "login"
      ? "Login"
      : "Create Account";

  $("#authSwitchBtn").textContent =
    mode === "login"
      ? "Don't have an account? Sign up"
      : "Already have an account? Login";

  $("#authUsername")
    .classList.toggle(
      "hidden",
      mode === "login"
    );

  $("#authMessage").textContent = "";

}


function closeAuth(){

  $("#authModal").classList.add("hidden");

}


function authMessage(text,error=false){

  const el = $("#authMessage");

  el.textContent = text;

  el.style.color =
    error ? "#ff7d8d" : "#8ea2ff";

}


/* =========================
   SIGNUP
========================= */

async function signup(){

  const email =
    $("#authEmail").value.trim();

  const password =
    $("#authPassword").value;

  const newUsername =
    $("#authUsername")
      .value
      .trim()
      .slice(0,20);


  if(!email || !password || !newUsername){

    authMessage(
      "Please fill all fields.",
      true
    );

    return;
  }


  if(password.length < 6){

    authMessage(
      "Password must be at least 6 characters.",
      true
    );

    return;
  }


  if(!/^[a-zA-Z0-9_. -]+$/.test(newUsername)){

    authMessage(
      "Username can contain letters, numbers, _ . - only.",
      true
    );

    return;
  }


  authMessage("Creating account...");


  try{

    const {
      data,
      error
    } =
      await supabaseClient.auth.signUp({
        email,
        password
      });


    if(error) throw error;


    if(!data.user){

      authMessage(
        "Account created. Check your email to verify it."
      );

      return;
    }


    const {
      error:profileError
    } =
      await supabaseClient
        .from("profiles")
        .upsert({
          id:data.user.id,
          username:newUsername
        });


    if(profileError)
      throw profileError;


    username = newUsername;

    localStorage.setItem(
      "zuno_name",
      username
    );

    currentUser = data.user;

    closeAuth();

    updateUserUI();

    enter(currentRoom);

  }catch(error){

    console.error(error);

    authMessage(
      error.message || "Signup failed.",
      true
    );

  }

}


/* =========================
   LOGIN
========================= */

async function login(){

  const email =
    $("#authEmail").value.trim();

  const password =
    $("#authPassword").value;


  if(!email || !password){

    authMessage(
      "Enter email and password.",
      true
    );

    return;
  }


  authMessage("Logging in...");


  try{

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });


    if(error) throw error;


    currentUser = data.user;

    await loadProfile();

    closeAuth();

    updateUserUI();

  }catch(error){

    console.error(error);

    authMessage(
      error.message || "Login failed.",
      true
    );

  }

}


/* =========================
   PROFILE
========================= */

async function loadProfile(){

  if(!currentUser) return;


  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("username,bio,avatar_url")
      .eq("id",currentUser.id)
      .maybeSingle();


  if(error){

    console.error(error);
    return;
  }


  if(data){

    username =
      data.username || username;

    localStorage.setItem(
      "zuno_name",
      username
    );

    $("#nameInput").value =
      username;

    $("#profileUsername").value =
      username;

    $("#profileBio").value =
      data.bio || "";

    $("#profileAvatar").src =
      data.avatar_url ||
      defaultAvatar(username);

  }

}


function updateUserUI(){

  if(!currentUser){

    $("#profileBtn")
      .classList.add("hidden");

    $("#logoutBtn")
      .classList.add("hidden");

    return;
  }


  $("#profileBtn")
    .classList.remove("hidden");

  $("#logoutBtn")
    .classList.remove("hidden");

  $("#nameInput").value =
    username;

  $("#sideUsername").textContent =
    username;

  loadSideAvatar();

}


async function loadSideAvatar(){

  if(!currentUser) return;


  const {
    data
  } =
    await supabaseClient
      .from("profiles")
      .select("avatar_url")
      .eq("id",currentUser.id)
      .maybeSingle();


  const avatar =
    data?.avatar_url ||
    defaultAvatar(username);


  $("#sideAvatar").innerHTML =
    `<img src="${avatar}" alt="">`;

}


async function checkAuth(){

  const {
    data
  } =
    await supabaseClient.auth
      .getSession();


  if(data.session){

    currentUser =
      data.session.user;

    await loadProfile();

    updateUserUI();

  }else{

    currentUser = null;

    $("#profileBtn")
      .classList.add("hidden");

    $("#logoutBtn")
      .classList.add("hidden");

  }

}


/* =========================
   LOGOUT
========================= */

async function logout(){

  clearHeartbeat();

  await removeOwnOnlineUser();

  removeChannels();

  await supabaseClient.auth.signOut();

  currentUser = null;

  privateUser = null;

  username = "";

  localStorage.removeItem("zuno_name");

  $("#chat").classList.add("hidden");
  $("#home").classList.remove("hidden");

  $("#profileBtn")
    .classList.add("hidden");

  $("#logoutBtn")
    .classList.add("hidden");

}


/* =========================
   ROOMS
========================= */

function renderRoom(){

  $("#roomTitle").textContent =
    `${roomIcons[currentRoom] || "💬"} ${currentRoom}`;


  document
    .querySelectorAll(".room")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.room === currentRoom
      );

    });

}


async function loadRoomTopic(){

  $("#roomTopic").textContent =
    defaultTopics[currentRoom] || "";


  const {
    data,
    error
  } =
    await supabaseClient
      .from("room_topics")
      .select("topic")
      .eq("room",currentRoom)
      .maybeSingle();


  if(!error && data?.topic){

    $("#roomTopic").textContent =
      data.topic;

  }

}


function openTopicEditor(){

  $("#topicRoomName").textContent =
    currentRoom;

  $("#topicInput").value =
    $("#roomTopic").textContent;

  $("#topicModal")
    .classList.remove("hidden");

}


function closeTopicEditor(){

  $("#topicModal")
    .classList.add("hidden");

}


async function saveRoomTopic(){

  const topic =
    $("#topicInput")
      .value
      .trim();


  if(!topic){

    alert("Topic cannot be empty.");

    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("room_topics")
      .upsert(
        {
          room:currentRoom,
          topic
        },
        {
          onConflict:"room"
        }
      );


  if(error){

    alert(
      "Topic save error: " +
      error.message
    );

    return;
  }


  $("#roomTopic").textContent =
    topic;

  closeTopicEditor();

}


/* =========================
   ONLINE USERS
========================= */

async function removeOwnOnlineUser(){

  if(!username) return;


  try{

    await supabaseClient
      .from("online_users")
      .delete()
      .eq("username",username);

  }catch(error){

    console.error(error);

  }

}


async function joinOnlineUsers(){

  if(!username) return;


  await removeOwnOnlineUser();


  const {
    data,
    error
  } =
    await supabaseClient
      .from("online_users")
      .insert({
        username,
        room:currentRoom,
        last_seen:Date.now()
      })
      .select()
      .maybeSingle();


  if(error){

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


async function loadOnlineUsers(){

  const cutoff =
    Date.now() - 45000;


  const {
    data,
    error
  } =
    await supabaseClient
      .from("online_users")
      .select("id,username,room,last_seen")
      .eq("room",currentRoom)
      .gt("last_seen",cutoff);


  if(error){

    console.error(error);
    return;
  }


  const {
    data:profiles
  } =
    await supabaseClient
      .from("profiles")
      .select("username,avatar_url");


  const avatarMap = {};

  (profiles || []).forEach(profile => {

    avatarMap[profile.username] =
      profile.avatar_url ||
      defaultAvatar(profile.username);

  });


  const people =
    $("#people");


  people.innerHTML =
    `<h3>Online now</h3>`;


  $("#onlineCount").textContent =
    data?.length || 0;


  if(!data?.length){

    people.innerHTML +=
      `<div class="empty-state">
        <span>👀</span>
        Nobody else is here.
      </div>`;

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
      defaultAvatar(person.username);


    div.innerHTML = `
      <img
        class="online-avatar"
        src="${avatar}"
        alt=""
      >

      <div class="online-user-info">

        <b>
          ${escapeHtml(person.username)}
          ${person.username === username
            ? " (you)"
            : ""}
        </b>

        <small>
          <span class="online-dot"></span>
          online
        </small>

      </div>
    `;


    if(
      person.username !== username
    ){

      div.onclick = () =>
        openPrivateChat(
          person.username
        );

    }


    people.appendChild(div);

  });

}


function startHeartbeat(){

  clearHeartbeat();


  heartbeatTimer =
    setInterval(async () => {

      if(!username) return;


      await supabaseClient
        .from("online_users")
        .update({
          last_seen:Date.now(),
          room:currentRoom
        })
        .eq("username",username);


      loadOnlineUsers();

    },15000);

}


function clearHeartbeat(){

  if(heartbeatTimer){

    clearInterval(
      heartbeatTimer
    );

    heartbeatTimer = null;

  }

}


function setupOnlineRealtime(){

  if(onlineChannel){

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
          event:"*",
          schema:"public",
          table:"online_users"
        },
        () => loadOnlineUsers()
      )
      .subscribe();

}


/* =========================
   ENTER ROOM
========================= */

async function enter(
  room=currentRoom
){

  if(!currentUser){

    showAuth("login");

    return;
  }


  if(!username){

    await loadProfile();

  }


  currentRoom = room;


  $("#home")
    .classList.add("hidden");

  $("#chat")
    .classList.remove("hidden");


  renderRoom();

  await loadRoomTopic();

  await joinOnlineUsers();

  startHeartbeat();

  setupOnlineRealtime();

  await renderMessages();

  setupRealtime();

  setupTyping();

}


/* =========================
   PUBLIC MESSAGES
========================= */

async function renderMessages(){

  const box =
    $("#messages");


  box.innerHTML = "";

  displayedMessages.clear();


  const {
    data:profiles
  } =
    await supabaseClient
      .from("profiles")
      .select("username,avatar_url");


  const avatarMap = {};


  (profiles || []).forEach(profile => {

    avatarMap[profile.username] =
      profile.avatar_url ||
      defaultAvatar(profile.username);

  });


  const {
    data,
    error
  } =
    await supabaseClient
      .from("messages")
      .select("*")
      .eq("room",currentRoom)
      .order("created_at",{
        ascending:true
      });


  if(error){

    console.error(
      "Messages error:",
      error
    );

    return;
  }


  if(!data?.length){

    box.innerHTML =
      `<div class="empty-state">
        <span>💬</span>
        Be the first to say something.
      </div>`;

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
          defaultAvatar(message.name)
      }
    );

  });


  box.scrollTop =
    box.scrollHeight;

}


function addMsg(
  name,
  text,
  mine=false,
  message=null
){

  const key =
    message
      ? `${message.room}|${message.name}|${message.text}|${message.created_at}`
      : `${name}|${text}`;


  if(displayedMessages.has(key))
    return;


  displayedMessages.add(key);


  const box =
    $("#messages");


  const empty =
    box.querySelector(".empty-state");

  if(empty)
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
        src="${avatar}"
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


async function send(){

  if(privateUser){

    await sendPrivate();

    return;
  }


  const input =
    $("#messageInput");

  const text =
    input.value.trim();


  if(!text || !username)
    return;


  input.disabled = true;


  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .insert({
          room:currentRoom,
          name:username,
          text,
          created_at:Date.now()
        })
        .select()
        .single();


    if(error)
      throw error;


    const {
      data:profile
    } =
      await supabaseClient
        .from("profiles")
        .select("avatar_url")
        .eq("username",username)
        .maybeSingle();


    addMsg(
      username,
      text,
      true,
      {
        ...data,
        avatar_url:
          profile?.avatar_url ||
          defaultAvatar(username)
      }
    );


    input.value = "";

    addXP(2);


    $("#messages").scrollTop =
      $("#messages").scrollHeight;

  }catch(error){

    console.error(error);

    alert(
      "Message send error: " +
      error.message
    );

  }finally{

    input.disabled = false;
    input.focus();

  }

}


/* =========================
   REALTIME PUBLIC
========================= */

function setupRealtime(){

  if(realtimeChannel){

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
          event:"INSERT",
          schema:"public",
          table:"messages",
          filter:
            `room=eq.${currentRoom}`
        },
        async payload => {

          const message =
            payload.new;


          if(
            message.name === username
          )
            return;


          const {
            data:profile
          } =
            await supabaseClient
              .from("profiles")
              .select("avatar_url")
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
                profile?.avatar_url ||
                defaultAvatar(
                  message.name
                )
            }
          );


          $("#messages").scrollTop =
            $("#messages").scrollHeight;

        }
      )
      .subscribe();

}


/* =========================
   TYPING
========================= */

function setupTyping(){

  if(typingChannel){

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
        event:"typing"
      },
      payload => {

        if(
          payload.payload.username ===
          username
        )
          return;


        $("#typingIndicator")
          .textContent =
            `${payload.payload.username} is typing...`;


        clearTimeout(typingTimer);


        typingTimer =
          setTimeout(() => {

            $("#typingIndicator")
              .textContent = "";

          },1500);

      }
    )
    .subscribe();

}


async function broadcastTyping(){

  if(
    !typingChannel ||
    !username ||
    privateUser
  )
    return;


  await typingChannel.send({
    type:"broadcast",
    event:"typing",
    payload:{
      username
    }
  });

}


/* =========================
   PRIVATE CHAT
========================= */

async function openPrivateChat(user){

  if(!user || user === username)
    return;


  privateUser = user;


  $("#publicChat")
    .classList.add("hidden");

  $("#privateChat")
    .classList.remove("hidden");

  $("#people")
    .classList.remove("show");

  $("#privateUserName")
    .textContent = user;

  $("#messageInput")
    .placeholder =
      `Message ${user}...`;


  await renderPrivateMessages();

  setupPrivateRealtime();

}


async function renderPrivateMessages(){

  const box =
    $("#privateMessages");


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
      .order("created_at",{
        ascending:true
      });


  if(error){

    console.error(error);

    return;
  }


  data?.forEach(message => {

    addPrivateMsg(
      message
    );

  });


  box.scrollTop =
    box.scrollHeight;

}


function addPrivateMsg(message){

  const key =
    `${message.sender}|${message.receiver}|${message.text}|${message.created_at}`;


  if(
    displayedPrivateMessages.has(key)
  )
    return;


  displayedPrivateMessages.add(key);


  const box =
    $("#privateMessages");


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
        src="${defaultAvatar(message.sender)}"
        alt=""
      >

      <div class="meta">
        ${escapeHtml(message.sender)}
      </div>

    </div>

    <div class="bubble">
      ${escapeHtml(message.text)}
    </div>

  `;


  box.appendChild(div);

}


async function sendPrivate(){

  if(!privateUser)
    return;


  const input =
    $("#messageInput");

  const text =
    input.value.trim();


  if(!text)
    return;


  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("private_messages")
        .insert({
          sender:username,
          receiver:privateUser,
          text,
          created_at:Date.now()
        })
        .select()
        .single();


    if(error)
      throw error;


    addPrivateMsg(data);

    input.value = "";

    addXP(3);


    $("#privateMessages").scrollTop =
      $("#privateMessages").scrollHeight;

  }catch(error){

    console.error(error);

    alert(
      "Private message error: " +
      error.message
    );

  }

}


function setupPrivateRealtime(){

  if(privateChannel){

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
          event:"INSERT",
          schema:"public",
          table:"private_messages"
        },
        payload => {

          const message =
            payload.new;


          const valid =
            (
              message.sender ===
              username &&
              message.receiver ===
              privateUser
            ) ||
            (
              message.sender ===
              privateUser &&
              message.receiver ===
              username
            );


          if(!valid)
            return;


          if(
            message.sender ===
            username
          )
            return;


          addPrivateMsg(message);


          $("#privateMessages")
            .scrollTop =
              $("#privateMessages")
                .scrollHeight;

        }
      )
      .subscribe();

}


function closePrivateChat(){

  privateUser = null;


  $("#privateChat")
    .classList.add("hidden");

  $("#publicChat")
    .classList.remove("hidden");

  $("#messageInput")
    .placeholder =
      "Write something...";


  if(privateChannel){

    supabaseClient
      .removeChannel(
        privateChannel
      );

    privateChannel = null;

  }

}


/* =========================
   XP SYSTEM
========================= */

function getXP(){

  if(!currentUser)
    return 0;


  return Number(
    localStorage.getItem(
      "zuno_xp_" +
      currentUser.id
    ) || 0
  );

}


function getLevel(xp){

  return Math.floor(
    xp / 100
  ) + 1;

}


function addXP(amount){

  if(!currentUser)
    return;


  const oldXP =
    getXP();

  const newXP =
    oldXP + amount;


  localStorage.setItem(
    "zuno_xp_" +
    currentUser.id,
    newXP
  );


  const oldLevel =
    getLevel(oldXP);

  const newLevel =
    getLevel(newXP);


  showXP(
    `⭐ +${amount} XP`
  );


  $("#sideLevel")
    .textContent =
      `Level ${newLevel}`;


  if(newLevel > oldLevel){

    setTimeout(() => {

      alert(
        `🎉 Level Up!\n\nYou reached Level ${newLevel}!`
      );

    },200);

  }

}


function updateLevel(){

  const level =
    getLevel(
      getXP()
    );


  $("#sideLevel")
    .textContent =
      `Level ${level}`;

}


function showXP(text){

  const toast =
    $("#xpToast");


  toast.textContent =
    text;


  toast.classList.remove(
    "hidden"
  );


  setTimeout(() => {

    toast.classList.add(
      "hidden"
    );

  },1200);

}


/* =========================
   PROFILE MODAL
========================= */

async function openProfile(){

  if(!currentUser){

    showAuth("login");

    return;
  }


  await loadProfile();


  $("#profileModal")
    .classList.remove("hidden");

}


function closeProfile(){

  $("#profileModal")
    .classList.add("hidden");

  $("#profileMessage")
    .textContent = "";

}


async function uploadAvatar(){

  const file =
    $("#avatarInput").files[0];


  if(!file)
    return null;


  if(file.size > 5 * 1024 * 1024){

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
          upsert:true,
          contentType:file.type
        }
      );


  if(error)
    throw error;


  const {
    data
  } =
    supabaseClient.storage
      .from("avatars")
      .getPublicUrl(path);


  return data.publicUrl +
    "?t=" +
    Date.now();

}


async function saveProfile(){

  if(!currentUser)
    return;


  const newName =
    $("#profileUsername")
      .value
      .trim()
      .slice(0,20);


  const bio =
    $("#profileBio")
      .value
      .trim()
      .slice(0,120);


  if(newName.length < 3){

    $("#profileMessage")
      .textContent =
        "Username must be at least 3 characters.";

    return;
  }


  if(
    !/^[a-zA-Z0-9_. -]+$/.test(
      newName
    )
  ){

    $("#profileMessage")
      .textContent =
        "Username contains invalid characters.";

    return;
  }


  $("#profileMessage")
    .textContent =
      "Saving...";


  try{

    let avatarUrl = null;


    if(
      $("#avatarInput").files.length
    ){

      avatarUrl =
        await uploadAvatar();

    }


    const updateData = {
      username:newName,
      bio
    };


    if(avatarUrl)
      updateData.avatar_url =
        avatarUrl;


    const {
      error
    } =
      await supabaseClient
        .from("profiles")
        .update(updateData)
        .eq("id",currentUser.id);


    if(error)
      throw error;


    username = newName;


    localStorage.setItem(
      "zuno_name",
      username
    );


    $("#nameInput").value =
      username;

    $("#sideUsername")
      .textContent =
        username;


    await loadProfile();

    await loadSideAvatar();

    await loadOnlineUsers();


    $("#profileMessage")
      .textContent =
        "✓ Profile updated!";


    setTimeout(
      closeProfile,
      700
    );


  }catch(error){

    console.error(error);

    $("#profileMessage")
      .textContent =
        error.message ||
        "Profile update failed.";

  }

}


/* =========================
   CHANNEL CLEANUP
========================= */

function removeChannels(){

  const channels = [
    realtimeChannel,
    privateChannel,
    onlineChannel,
    typingChannel
  ];


  channels.forEach(channel => {

    if(channel){

      supabaseClient
        .removeChannel(channel);

    }

  });


  realtimeChannel = null;
  privateChannel = null;
  onlineChannel = null;
  typingChannel = null;

}


/* =========================
   THEME
========================= */

function loadTheme(){

  const theme =
    localStorage.getItem(
      "zuno_theme"
    ) ||
    localStorage.getItem(
      "vibechat_theme"
    );


  if(theme === "light"){

    document.body
      .classList.add("light");

    $("#themeBtn")
      .textContent = "☀";

  }

}


function toggleTheme(){

  const light =
    document.body
      .classList.toggle("light");


  localStorage.setItem(
    "zuno_theme",
    light ? "light" : "dark"
  );


  $("#themeBtn")
    .textContent =
      light ? "☀" : "☾";

}


/* =========================
   EVENTS
========================= */

$("#joinBtn").onclick = () => {

  if(currentUser)
    enter(currentRoom);
  else
    showAuth("login");

};


$("#nameInput").addEventListener(
  "keydown",
  e => {

    if(e.key === "Enter"){

      if(currentUser)
        enter(currentRoom);
      else
        showAuth("login");

    }

  }
);


document
  .querySelectorAll(".roomcard")
  .forEach(card => {

    card.onclick = () =>
      enter(card.dataset.room);

  });


document
  .querySelectorAll(".room")
  .forEach(button => {

    button.onclick = async () => {

      if(!currentUser){

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

    };

  });


$("#sendBtn").onclick =
  send;


$("#messageInput").addEventListener(
  "keydown",
  e => {

    if(e.key === "Enter")
      send();

  }
);


$("#messageInput").addEventListener(
  "input",
  broadcastTyping
);


$("#emojiBtn").onclick = () => {

  $("#emojiPanel")
    .classList.toggle(
      "hidden"
    );

};


document
  .querySelectorAll(
    "#emojiPanel button"
  )
  .forEach(button => {

    button.onclick = () => {

      const input =
        $("#messageInput");


      input.value +=
        button.textContent;


      input.focus();

    };

  });


$("#usersBtn").onclick = () => {

  $("#people")
    .classList.toggle("show");

};


$("#privateBackBtn").onclick =
  closePrivateChat;


$("#editTopicBtn").onclick =
  openTopicEditor;


$("#closeTopicBtn").onclick =
  closeTopicEditor;


$("#cancelTopicBtn").onclick =
  closeTopicEditor;


$("#saveTopicBtn").onclick =
  saveRoomTopic;


$("#closeAuthBtn").onclick =
  closeAuth;


$("#authSwitchBtn").onclick = () => {

  showAuth(
    authMode === "login"
      ? "signup"
      : "login"
  );

};


$("#authSubmitBtn").onclick = () => {

  if(authMode === "login")
    login();
  else
    signup();

};


$("#authPassword").addEventListener(
  "keydown",
  e => {

    if(e.key === "Enter"){

      if(authMode === "login")
        login();
      else
        signup();

    }

  }
);


$("#logoutBtn").onclick =
  logout;


$("#profileBtn").onclick =
  openProfile;


$("#closeProfileBtn").onclick =
  closeProfile;


$("#saveProfileBtn").onclick =
  saveProfile;


$("#avatarInput").addEventListener(
  "change",
  () => {

    const file =
      $("#avatarInput").files[0];


    if(!file)
      return;


    const reader =
      new FileReader();


    reader.onload = e => {

      $("#profileAvatar").src =
        e.target.result;

    };


    reader.readAsDataURL(file);

  }
);


$("#themeBtn").onclick =
  toggleTheme;


$("#backBtn").onclick =
  async () => {

    clearHeartbeat();

    await removeOwnOnlineUser();

    removeChannels();

    closePrivateChat();

    $("#chat")
      .classList.add("hidden");

    $("#home")
      .classList.remove("hidden");

  };


/* =========================
   START
========================= */

(async function(){

  renderRoom();

  loadTheme();

  await checkAuth();

  updateLevel();

})();

const $ = s => document.querySelector(s);

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
   USER / AUTH
========================= */

let username =
  localStorage.getItem("vibechat_name") || "";

let currentUser = null;

let authMode = "login";


/* =========================
   CHAT STATE
========================= */

let currentRoom = "Chill Zone";

let privateUser = null;

let realtimeChannel = null;
let onlineChannel = null;
let typingChannel = null;
let privateChannel = null;

let onlineUserId = null;
let heartbeatTimer = null;
let typingTimer = null;

let displayedMessages = new Set();
let displayedPrivateMessages = new Set();


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


const samples = [
  ["Nova","Welcome everyone! 👋"],
  ["Arya","Anyone listening to something good? 🎵"],
  ["Zayn","This room is actually pretty chill 😎"],
  ["Pixel","Heyyy everyone ✨"]
];


function escapeHtml(value){

  return String(value).replace(
    /[&<>"']/g,
    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[c])
  );

}


/* =========================
   AUTH UI
========================= */

function showAuth(mode = "login"){

  authMode = mode;

  $("#authModal")
    .classList
    .remove("hidden");

  if(mode === "signup"){

    $("#authTitle").textContent =
      "Create Account";

    $("#authSubtitle").textContent =
      "Join VibeChat and start chatting";

    $("#authUsername")
      .classList
      .remove("hidden");

    $("#authSubmitBtn").textContent =
      "Create Account";

    $("#authSwitchBtn").textContent =
      "Already have an account? Login";

  }else{

    $("#authTitle").textContent =
      "Welcome Back";

    $("#authSubtitle").textContent =
      "Login to continue to VibeChat";

    $("#authUsername")
      .classList
      .add("hidden");

    $("#authSubmitBtn").textContent =
      "Login";

    $("#authSwitchBtn").textContent =
      "Don't have an account? Sign up";

  }

  $("#authMessage").textContent = "";

}


function closeAuth(){

  $("#authModal")
    .classList
    .add("hidden");

}


function authMessage(text, error = false){

  const box =
    $("#authMessage");

  box.textContent = text;

  box.style.color =
    error ? "#ff6b81" : "";

}


/* =========================
   SIGNUP
========================= */

async function signup(){

  const email =
    $("#authEmail")
      .value
      .trim();

  const password =
    $("#authPassword")
      .value;

  const newUsername =
    $("#authUsername")
      .value
      .trim()
      .slice(0,20);


  if(!email || !password || !newUsername){

    authMessage(
      "Email, password aur username sab bharna zaroori hai.",
      true
    );

    return;

  }


  if(newUsername.length < 3){

    authMessage(
      "Username kam se kam 3 characters ka hona chahiye.",
      true
    );

    return;

  }


  authMessage(
    "Account create ho raha hai..."
  );


  try{

    const {
      data,
      error
    } =
      await supabaseClient.auth.signUp({
        email:email,
        password:password
      });


    if(error) throw error;


    if(!data.user){

      throw new Error(
        "Account create nahi hua."
      );

    }


    const {
      error:profileError
    } =
      await supabaseClient
        .from("profiles")
        .insert({
          id:data.user.id,
          username:newUsername
        });


    if(profileError){

      if(
        profileError.code === "23505"
      ){

        authMessage(
          "Ye username already taken hai. Dusra username choose karo.",
          true
        );

      }else{

        authMessage(
          "Profile create error: " +
          profileError.message,
          true
        );

      }

      return;

    }


    username =
      newUsername;

    currentUser =
      data.user;


    localStorage.setItem(
      "vibechat_name",
      username
    );


    authMessage(
      "Account successfully created! 🎉"
    );


    setTimeout(
      () => {

        closeAuth();

        $("#nameInput").value =
          username;

      },
      700
    );


  }catch(error){

    authMessage(
      error.message ||
      "Signup failed.",
      true
    );

  }

}


/* =========================
   LOGIN
========================= */

async function login(){

  const email =
    $("#authEmail")
      .value
      .trim();

  const password =
    $("#authPassword")
      .value;


  if(!email || !password){

    authMessage(
      "Email aur password enter karo.",
      true
    );

    return;

  }


  authMessage(
    "Login ho raha hai..."
  );


  try{

    const {
      data,
      error
    } =
      await supabaseClient.auth.signInWithPassword({
        email:email,
        password:password
      });


    if(error) throw error;


    currentUser =
      data.user;


    await loadProfile();


    authMessage(
      "Login successful! 🎉"
    );


    setTimeout(
      () => {

        closeAuth();

        $("#nameInput").value =
          username;

      },
      500
    );


  }catch(error){

    authMessage(
      error.message ||
      "Login failed.",
      true
    );

  }

}


/* =========================
   LOAD PROFILE
========================= */

async function loadProfile(){

  if(!currentUser){

    return false;

  }


  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .select("username,bio,avatar_url")
        .eq("id",currentUser.id)
        .maybeSingle();


    if(error) throw error;


    if(!data){

      return false;

    }


    username =
      data.username;


    localStorage.setItem(
      "vibechat_name",
      username
    );


    $("#nameInput").value =
      username;


    return true;


  }catch(error){

    console.error(
      "Profile:",
      error
    );

    return false;

  }

}


/* =========================
   AUTH CHECK
========================= */

async function checkAuth(){

  const {
    data
  } =
    await supabaseClient.auth.getSession();


  currentUser =
    data?.session?.user || null;


  if(currentUser){

    const loaded =
      await loadProfile();


    if(!loaded){

      username = "";

      showAuth("login");

    }

  }else{

    username = "";

    localStorage.removeItem(
      "vibechat_name"
    );

  }

}


async function logout(){

  if(heartbeatTimer){

    clearInterval(
      heartbeatTimer
    );

    heartbeatTimer = null;

  }


  await removeOwnOnlineUser();


  if(realtimeChannel){

    await supabaseClient
      .removeChannel(
        realtimeChannel
      );

    realtimeChannel = null;

  }


  if(onlineChannel){

    await supabaseClient
      .removeChannel(
        onlineChannel
      );

    onlineChannel = null;

  }


  if(typingChannel){

    await supabaseClient
      .removeChannel(
        typingChannel
      );

    typingChannel = null;

  }


  closePrivateChat();


  await supabaseClient.auth.signOut();


  currentUser = null;
  username = "";


  localStorage.removeItem(
    "vibechat_name"
  );


  $("#chat")
    .classList
    .add("hidden");

  $("#home")
    .classList
    .remove("hidden");

  $("#nameInput").value = "";

  showAuth("login");

}


/* =========================
   ROOM
========================= */

function renderRoom(){

  $("#roomTitle").textContent =
    (roomIcons[currentRoom] || "💬") +
    " " +
    currentRoom;


  document
    .querySelectorAll(".room")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.room === currentRoom
      );

    });

}


/* =========================
   TOPIC
========================= */

async function loadRoomTopic(){

  const topic =
    $("#roomTopic");

  topic.textContent =
    defaultTopics[currentRoom] || "";


  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("room_topics")
        .select("topic")
        .eq("room",currentRoom)
        .maybeSingle();


    if(error) throw error;


    if(data?.topic){

      topic.textContent =
        data.topic;

    }

  }catch(error){

    console.log(
      "Topic:",
      error.message
    );

  }

}


function openTopicEditor(){

  $("#topicRoomName").textContent =
    currentRoom;

  $("#topicInput").value =
    $("#roomTopic").textContent;

  $("#topicModal")
    .classList
    .remove("hidden");

  $("#topicInput").focus();

}


function closeTopicEditor(){

  $("#topicModal")
    .classList
    .add("hidden");

}


async function saveRoomTopic(){

  const topic =
    $("#topicInput")
      .value
      .trim()
      .slice(0,100);


  if(!topic){

    alert(
      "Topic empty nahi ho sakta."
    );

    return;

  }


  try{

    const {
      error
    } =
      await supabaseClient
        .from("room_topics")
        .upsert(
          {
            room:currentRoom,
            topic:topic
          },
          {
            onConflict:"room"
          }
        );


    if(error) throw error;


    $("#roomTopic").textContent =
      topic;


    closeTopicEditor();


  }catch(error){

    alert(
      "Topic save nahi hua: " +
      error.message
    );

  }

}


/* =========================
   ONLINE USERS
========================= */

async function removeOwnOnlineUser(){

  if(!onlineUserId){

    return;

  }


  await supabaseClient
    .from("online_users")
    .delete()
    .eq(
      "id",
      onlineUserId
    );


  onlineUserId = null;

}


async function joinOnlineUsers(){

  await removeOwnOnlineUser();


  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("online_users")
        .insert({
          username:username,
          room:currentRoom,
          last_seen:Date.now()
        })
        .select("id")
        .single();


    if(error) throw error;


    onlineUserId =
      data.id;


    await loadOnlineUsers();


  }catch(error){

    console.error(
      "Online:",
      error
    );

  }

}


async function loadOnlineUsers(){

  try{

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
        .eq(
          "room",
          currentRoom
        )
        .gt(
          "last_seen",
          cutoff
        )
        .order(
          "last_seen",
          {
            ascending:false
          }
        );


    if(error) throw error;


    $("#onlineCount").textContent =
      data?.length || 0;


    const people =
      $("#people");


    people.innerHTML =
      "<h3>Online now</h3>";


    (data || []).forEach(user => {

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
              : "Chat"
          }
        </small>
      `;


      if(user.id !== onlineUserId){

        div.style.cursor =
          "pointer";

        div.title =
          "Open private chat";


        div.onclick =
          () => openPrivateChat(
            user.username
          );

      }


      people.appendChild(div);

    });


  }catch(error){

    console.error(
      "Users:",
      error
    );

  }

}


/* =========================
   HEARTBEAT
========================= */

function startHeartbeat(){

  if(heartbeatTimer){

    clearInterval(
      heartbeatTimer
    );

  }


  heartbeatTimer =
    setInterval(
      async () => {

        if(!onlineUserId) return;


        await supabaseClient
          .from("online_users")
          .update({
            last_seen:Date.now(),
            username:username,
            room:currentRoom
          })
          .eq(
            "id",
            onlineUserId
          );


        loadOnlineUsers();

      },
      15000
    );

}


/* =========================
   ONLINE REALTIME
========================= */

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
        "online-" +
        Date.now()
      )
      .on(
        "postgres_changes",
        {
          event:"*",
          schema:"public",
          table:"online_users"
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

async function enter(
  room = currentRoom
){

  if(!currentUser){

    showAuth("login");

    return;

  }


  const name =
    username;


  if(!name){

    await loadProfile();

  }


  if(!username){

    showAuth("login");

    return;

  }


  currentRoom =
    room;


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

  setupTyping();

}


/* =========================
   PUBLIC MESSAGES
========================= */

async function renderMessages(){

  const box =
    $("#messages");


  /* =========================
     LOAD PROFILE AVATARS
  ========================= */

  const {
    data: profileData
  } =
    await supabaseClient
      .from("profiles")
      .select("username, avatar_url");


  const avatarMap = {};


  (profileData || []).forEach(
    profile => {

      avatarMap[profile.username] =
        profile.avatar_url || "";

    }
  );


  /* =========================
     CLEAR OLD MESSAGES
  ========================= */

  box.innerHTML = "";

  displayedMessages.clear();


  /* =========================
     SAMPLE MESSAGES
  ========================= */

  samples.forEach(
    ([name,text]) => {

      addMsg(
        name,
        text,
        false
      );

    }
  );


  /* =========================
     LOAD DATABASE MESSAGES
  ========================= */

  try{

    const {
      data,
      error
    } =
      await supabaseClient
        .from("messages")
        .select("*")
        .eq(
          "room",
          currentRoom
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if(error) throw error;


    (data || []).forEach(
      message => {

        addMsg(
          message.name,
          message.text,
          message.name === username,
          {
            ...message,
            avatar_url:
              avatarMap[message.name] || ""
          }
        );

      }
    );


    box.scrollTop =
      box.scrollHeight;


  }catch(error){

    console.error(
      "Messages:",
      error
    );

  }

}

function addMsg(
  name,
  text,
  mine,
  message = null
){

  const key =
    message
      ? `${message.room}|${message.name}|${message.text}|${message.created_at}`
      : `sample|${name}|${text}`;

  if(displayedMessages.has(key)){
    return;
  }

  displayedMessages.add(key);

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

  $("#messages")
    .appendChild(div);
}


/* =========================
   PUBLIC SEND
========================= */

async function send(){

  if(privateUser){

    await sendPrivate();

    return;

  }


  const input =
    $("#messageInput");


  const text =
    input.value.trim();


  if(
    !text ||
    !username ||
    !currentUser
  ){

    return;

  }


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
          text:text,
          created_at:Date.now()
        })
        .select();


    if(error) throw error;


    if(data?.[0]){

      addMsg(
        username,
        text,
        true,
        data[0]
      );

    }


    input.value = "";


  }catch(error){

    alert(
      "Message send error: " +
      error.message
    );

  }

}


/* =========================
   PUBLIC REALTIME
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
        currentRoom +
        "-" +
        Date.now()
      )
      .on(
        "broadcast",
        {
          event:"typing"
        },
        payload => {

          const data =
            payload.payload;


          if(
            data &&
            data.username !== username &&
            data.room === currentRoom
          ){

            $("#typingIndicator")
              .textContent =
              data.username +
              " is typing...";


            clearTimeout(
              window.publicTypingTimer
            );


            window.publicTypingTimer =
              setTimeout(
                () => {

                  $("#typingIndicator")
                    .textContent = "";

                },
                1800
              );

          }

        }
      )
      .subscribe();

}


/* =========================
   PRIVATE CHAT
========================= */

async function openPrivateChat(
  user
){

  privateUser =
    user;


  $("#publicChat")
    .classList
    .add("hidden");


  $("#privateChat")
    .classList
    .remove("hidden");


  $("#privateUserName")
    .textContent =
    user;


  $("#messageInput")
    .placeholder =
    "Message " +
    user +
    "...";


  $("#people")
    .classList
    .remove("show");


  await renderPrivateMessages();

  setupPrivateRealtime();

}


async function renderPrivateMessages(){

  const box =
    $("#privateMessages");


  box.innerHTML = "";

  displayedPrivateMessages.clear();


  try{

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
            ascending:true
          }
        );


    if(error) throw error;


    (data || []).forEach(
      message => {

        addPrivateMsg(
          message
        );

      }
    );


    box.scrollTop =
      box.scrollHeight;


  }catch(error){

    console.error(
      "Private messages:",
      error
    );

  }

}


function addPrivateMsg(message){

  const key =
    String(message.id);


  if(
    displayedPrivateMessages.has(key)
  ){

    return;

  }


  displayedPrivateMessages.add(key);


  const mine =
    message.sender === username;


  const div =
    document.createElement("div");


  div.className =
    "msg" +
    (mine ? " mine" : "");


  div.innerHTML = `
    <div class="meta">
      ${escapeHtml(message.sender)}
    </div>

    <div class="bubble">
      ${escapeHtml(message.text)}
    </div>
  `;


  $("#privateMessages")
    .appendChild(div);

}


async function sendPrivate(){

  const input =
    $("#messageInput");


  const text =
    input.value.trim();


  if(
    !text ||
    !username ||
    !privateUser ||
    !currentUser
  ){

    return;

  }


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
          text:text,
          created_at:Date.now()
        })
        .select()
        .single();


    if(error) throw error;


    addPrivateMsg(data);


    input.value = "";


    $("#privateMessages").scrollTop =
      $("#privateMessages").scrollHeight;


  }catch(error){

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
              message.sender === privateUser &&
              message.receiver === username
            ) ||
            (
              message.sender === username &&
              message.receiver === privateUser
            );


          if(!valid) return;


          addPrivateMsg(message);


          $("#privateMessages").scrollTop =
            $("#privateMessages").scrollHeight;

        }
      )
      .subscribe();

}


function closePrivateChat(){

  privateUser = null;


  $("#privateChat")
    .classList
    .add("hidden");


  $("#publicChat")
    .classList
    .remove("hidden");


  $("#messageInput")
    .placeholder =
    "Write a message…";


  if(privateChannel){

    supabaseClient
      .removeChannel(
        privateChannel
      );


    privateChannel = null;

  }

}


/* =========================
   USERS
========================= */

$("#usersBtn").onclick =
  () => {

    $("#people")
      .classList
      .toggle("show");

  };


/* =========================
   ROOMS
========================= */

document
  .querySelectorAll(".roomcard")
  .forEach(button => {

    button.onclick =
      () => enter(
        button.dataset.room
      );

  });


document
  .querySelectorAll(".room")
  .forEach(button => {

    button.onclick =
      async () => {

        if(!currentUser){

          showAuth("login");

          return;

        }


        const newRoom =
          button.dataset.room;


        if(
          newRoom === currentRoom
        ){

          return;

        }


        closePrivateChat();


        currentRoom =
          newRoom;


        renderRoom();


        await joinOnlineUsers();

        await loadRoomTopic();

        await renderMessages();

        setupRealtime();

        setupTyping();

      };

  });


/* =========================
   JOIN
========================= */

$("#joinBtn").onclick =
  () => {

    if(currentUser){

      enter();

    }else{

      showAuth("login");

    }

  };


$("#nameInput").addEventListener(
  "keydown",
  e => {

    if(e.key === "Enter"){

      if(currentUser){

        enter();

      }else{

        showAuth("login");

      }

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

    if(e.key === "Enter"){

      send();

    }

  }
);


/* =========================
   TYPING
========================= */

$("#messageInput").addEventListener(
  "input",
  async () => {

    if(
      !typingChannel ||
      privateUser
    ){

      return;

    }


    await typingChannel.send({
      type:"broadcast",
      event:"typing",
      payload:{
        username:username,
        room:currentRoom
      }
    });

  }
);


/* =========================
   PRIVATE BACK
========================= */

$("#privateBackBtn").onclick =
  closePrivateChat;


/* =========================
   EMOJI
========================= */

$("#emojiBtn").onclick =
  () => {

    $("#emojiPanel")
      .classList
      .toggle("hidden");

  };


document
  .querySelectorAll(
    "#emojiPanel button"
  )
  .forEach(button => {

    button.onclick =
      () => {

        $("#messageInput")
          .value +=
          button.textContent;


        $("#messageInput")
          .focus();

      };

  });


/* =========================
   TOPIC
========================= */

$("#editTopicBtn").onclick =
  openTopicEditor;

$("#closeTopicBtn").onclick =
  closeTopicEditor;

$("#cancelTopicBtn").onclick =
  closeTopicEditor;

$("#saveTopicBtn").onclick =
  saveRoomTopic;


/* =========================
   AUTH BUTTONS
========================= */

$("#authSubmitBtn").onclick =
  async () => {

    if(authMode === "signup"){

      await signup();

    }else{

      await login();

    }

  };


$("#authSwitchBtn").onclick =
  () => {

    if(authMode === "login"){

      showAuth("signup");

    }else{

      showAuth("login");

    }

  };


$("#closeAuthBtn").onclick =
  closeAuth;


$("#authPassword").addEventListener(
  "keydown",
  e => {

    if(e.key === "Enter"){

      if(authMode === "signup"){

        signup();

      }else{

        login();

      }

    }

  }
);


/* =========================
   LOGOUT BUTTON
========================= */

const topbar =
  document.querySelector(".topbar");


if(topbar){

  const logoutBtn =
    document.createElement("button");


  logoutBtn.id =
    "logoutBtn";

  logoutBtn.className =
    "iconbtn";

  logoutBtn.textContent =
    "↪";


  logoutBtn.title =
    "Logout";


  topbar.appendChild(
    logoutBtn
  );


  logoutBtn.onclick =
    logout;

}


/* =========================
   THEME
========================= */

const savedTheme =
  localStorage.getItem(
    "vibechat_theme"
  );


if(savedTheme === "light"){

  document.body
    .classList
    .add("light");


  $("#themeBtn")
    .textContent = "☀";

}


$("#themeBtn").onclick =
  () => {

    document.body
      .classList
      .toggle("light");


    const light =
      document.body
        .classList
        .contains("light");


    localStorage.setItem(
      "vibechat_theme",
      light
        ? "light"
        : "dark"
    );


    $("#themeBtn")
      .textContent =
      light ? "☀" : "☾";

  };


/* =========================
   BACK
========================= */

$("#backBtn").onclick =
  async () => {

    if(heartbeatTimer){

      clearInterval(
        heartbeatTimer
      );

      heartbeatTimer = null;

    }


    await removeOwnOnlineUser();


    if(realtimeChannel){

      supabaseClient
        .removeChannel(
          realtimeChannel
        );

    }


    if(onlineChannel){

      supabaseClient
        .removeChannel(
          onlineChannel
        );

    }


    if(typingChannel){

      supabaseClient
        .removeChannel(
          typingChannel
        );

    }


    closePrivateChat();


    $("#chat")
      .classList
      .add("hidden");


    $("#home")
      .classList
      .remove("hidden");

  };


/* =========================
   START
========================= */

(async function(){

  renderRoom();

  await checkAuth();

})();

// =========================
// V4 PROFILE SYSTEM
// =========================

function defaultAvatar(name = "User"){
  const letter =
    (name || "U").charAt(0).toUpperCase();

  return (
    "https://ui-avatars.com/api/" +
    "?name=" +
    encodeURIComponent(letter) +
    "&background=667eea&color=fff&size=200"
  );
}


async function loadMyProfile(){

  if(!currentUser) return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("username,bio,avatar_url")
      .eq("id", currentUser.id)
      .maybeSingle();

  if(error){
    console.error("Profile load:", error);
    return;
  }

  if(!data) return;

  $("#profileUsername").value =
    data.username || "";

  $("#profileBio").value =
    data.bio || "";

  $("#profileAvatar").src =
    data.avatar_url ||
    defaultAvatar(data.username);
}


function openProfile(){

  if(!currentUser){
    showAuth("login");
    return;
  }

  loadMyProfile();

  $("#profileModal")
    .classList
    .remove("hidden");
}


function closeProfile(){

  $("#profileModal")
    .classList
    .add("hidden");

  $("#profileMessage").textContent = "";
}


async function uploadAvatar(file){

  if(!file || !currentUser){
    return null;
  }

  if(!file.type.startsWith("image/")){
    throw new Error(
      "Sirf image file upload karo."
    );
  }

  if(file.size > 5 * 1024 * 1024){
    throw new Error(
      "Image 5MB se chhoti honi chahiye."
    );
  }

  const extension =
    file.name.split(".").pop() || "jpg";

  const filePath =
    currentUser.id +
    "/avatar." +
    extension;

  const {
    error
  } =
    await supabaseClient
      .storage
      .from("avatars")
      .upload(
        filePath,
        file,
        {
          upsert:true,
          contentType:file.type
        }
      );

  if(error) throw error;

  const {
    data
  } =
    supabaseClient
      .storage
      .from("avatars")
      .getPublicUrl(filePath);

  return data.publicUrl;
}


async function saveProfile(){

  if(!currentUser){
    showAuth("login");
    return;
  }

  const newUsername =
    $("#profileUsername")
      .value
      .trim()
      .slice(0,20);

  const bio =
    $("#profileBio")
      .value
      .trim()
      .slice(0,120);

  if(newUsername.length < 3){

    $("#profileMessage").textContent =
      "Username kam se kam 3 characters ka hona chahiye.";

    return;
  }

  $("#profileMessage").textContent =
    "Profile save ho rahi hai...";

  try{

    let avatarUrl =
      $("#profileAvatar").dataset.url || "";

    const file =
      $("#avatarInput").files[0];

    if(file){

      $("#profileMessage").textContent =
        "PFP upload ho rahi hai...";

      avatarUrl =
        await uploadAvatar(file);

      $("#profileAvatar").dataset.url =
        avatarUrl;
    }

    const {
      error
    } =
      await supabaseClient
        .from("profiles")
        .update({
          username:newUsername,
          bio:bio,
          avatar_url:avatarUrl || null
        })
        .eq("id",currentUser.id);

    if(error){

      if(error.code === "23505"){

        throw new Error(
          "Ye username already taken hai."
        );

      }

      throw error;
    }

    username =
      newUsername;

    localStorage.setItem(
      "vibechat_name",
      username
    );

    $("#nameInput").value =
      username;

    $("#profileMessage").textContent =
      "Profile saved successfully! 🎉";

    await loadOnlineUsers();

    setTimeout(
      closeProfile,
      700
    );

  }catch(error){

    console.error(
      "Profile save:",
      error
    );

    $("#profileMessage").textContent =
      error.message ||
      "Profile save nahi hui.";

  }
}


$("#closeProfileBtn").onclick =
  closeProfile;


$("#saveProfileBtn").onclick =
  saveProfile;


$("#avatarInput").addEventListener(
  "change",
  event => {

    const file =
      event.target.files[0];

    if(!file) return;

    if(!file.type.startsWith("image/")){
      $("#profileMessage").textContent =
        "Sirf image select karo.";
      return;
    }

    const reader =
      new FileReader();

    reader.onload =
      () => {

        $("#profileAvatar").src =
          reader.result;

      };

    reader.readAsDataURL(file);

  }
);

const profileBtn =
  document.createElement("button");

profileBtn.id =
  "profileBtn";

profileBtn.className =
  "iconbtn";

profileBtn.textContent =
  "👤";

profileBtn.title =
  "My Profile";

profileBtn.onclick =
  openProfile;

const topbarElement =
  document.querySelector(".topbar");

if(topbarElement){
  topbarElement.prepend(profileBtn);
}

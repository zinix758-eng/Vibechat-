
const $=s=>document.querySelector(s);
let username=localStorage.getItem("vibechat_name")||"";
let currentRoom="Chill Zone";
const roomIcons={"Chill Zone":"🌙","Music Lounge":"🎵","Gaming":"🎮","Random":"💭"};
const samples=[
  ["Nova","Welcome everyone! 👋"],["Arya","Anyone listening to something good? 🎵"],["Zayn","This room is actually pretty chill 😎"],["Pixel","Heyyy everyone ✨"]
];
function enter(room=currentRoom){
  const name=($("#nameInput").value.trim()||username||"Guest").slice(0,20);
  username=name; localStorage.setItem("vibechat_name",name);
  currentRoom=room;
  $("#home").classList.add("hidden"); $("#chat").classList.remove("hidden");
  $("#meName").textContent=name; renderRoom(); renderMessages();
}
function renderRoom(){
  $("#roomTitle").textContent=(roomIcons[currentRoom]||"💬")+" "+currentRoom;
  document.querySelectorAll(".room").forEach(x=>x.classList.toggle("active",x.dataset.room===currentRoom));
}
function renderMessages(){
  const box=$("#messages"); box.innerHTML="";
  samples.forEach(([n,t])=>addMsg(n,t,false));
  const saved=JSON.parse(localStorage.getItem("vc_"+currentRoom)||"[]");
  saved.forEach(m=>addMsg(m.name,m.text,m.name===username));
  box.scrollTop=box.scrollHeight;
}
function addMsg(name,text,mine){
  const d=document.createElement("div"); d.className="msg"+(mine?" mine":"");
  d.innerHTML=`<div class="meta">${escapeHtml(name)}</div><div class="bubble">${escapeHtml(text)}</div>`;
  $("#messages").appendChild(d);
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function send(){
  const input=$("#messageInput"), text=input.value.trim(); if(!text)return;
  if(!username) return;
  const key="vc_"+currentRoom, arr=JSON.parse(localStorage.getItem(key)||"[]");
  arr.push({name:username,text}); localStorage.setItem(key,JSON.stringify(arr.slice(-100)));
  addMsg(username,text,true); input.value=""; $("#messages").scrollTop=999999;
}
$("#joinBtn").onclick=()=>enter();
$("#nameInput").addEventListener("keydown",e=>{if(e.key==="Enter")enter()});
document.querySelectorAll(".roomcard").forEach(b=>b.onclick=()=>enter(b.dataset.room));
document.querySelectorAll(".room").forEach(b=>b.onclick=()=>{currentRoom=b.dataset.room;renderRoom();renderMessages()});
$("#sendBtn").onclick=send;
$("#messageInput").addEventListener("keydown",e=>{if(e.key==="Enter")send()});
$("#backBtn").onclick=()=>{$("#chat").classList.add("hidden");$("#home").classList.remove("hidden")};
$("#emojiBtn").onclick=()=>$("#emojiPanel").classList.toggle("hidden");
$("#emojiPanel").onclick=e=>{if(e.target.textContent.trim()){const i=$("#messageInput");i.value+=e.target.textContent.trim();i.focus()}};
$("#themeBtn").onclick=()=>document.body.classList.toggle("light");
if(username) $("#nameInput").value=username;
renderRoom();

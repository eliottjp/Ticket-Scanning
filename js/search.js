import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔹 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCd5lYY7EAkxYzV_lbolu7KFx8nTEHiLug",
  authDomain: "ticket-scanner-2b7f1.firebaseapp.com",
  projectId: "ticket-scanner-2b7f1",
  storageBucket: "ticket-scanner-2b7f1.appspot.com",
  messagingSenderId: "431290258037",
  appId: "1:431290258037:web:73fa6d44e5335c37989e3c",
};

// 🔹 Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let eventID = null;
let results = [];

// 🔹 Fetch Active Event
async function fetchEventID() {
  const globalRef = doc(db, "GlobalSettings", "CurrentEvent");
  const docSnap = await getDoc(globalRef);

  if (docSnap.exists()) {
    eventID = docSnap.data().eventID;
    console.log(`📂 Active Event ID: ${eventID}`);

    // 🛠️ Split eventID to extract name and date
    const parts = eventID.split("_");
    if (parts.length < 3) {
      console.warn("⚠️ Unexpected eventID format!");
      return;
    }

    const eventDate = parts.pop(); // Last part is the date
    const eventName = parts.join(" "); // Remaining parts are the name

    console.log(`📅 Event Name: ${eventName}`);
    console.log(`📆 Event Date: ${eventDate}`);

    // Update UI
    const eventElement = document.getElementById("currentEvent");
    if (eventElement) {
      eventElement.innerHTML = `<strong>📅 ${eventName} | ${eventDate}</strong>`;
    }
  } else {
    console.warn("⚠️ No active event found!");
  }
}
fetchEventID();

// 🔹 Search Function
document
  .getElementById("searchInput")
  .addEventListener("input", async function () {
    const searchValue = this.value.trim().toLowerCase();

    if (searchValue.length < 3) {
      document.getElementById("searchResults").innerHTML = "";
      return;
    }

    if (!eventID) {
      console.warn("⚠️ No event ID set!");
      return;
    }

    const ticketsRef = collection(db, eventID);
    const querySnapshot = await getDocs(ticketsRef);

    results = [];
    querySnapshot.forEach((docSnap) => {
      let ticket = docSnap.data();
      if (ticket.name.toLowerCase().includes(searchValue)) {
        results.push({ id: docSnap.id, ...ticket });
      }
    });

    displayResults(results);
  });

// 🔹 Display Search Results with Modal Trigger
function displayResults(results) {
  const resultsList = document.getElementById("searchResults");
  resultsList.innerHTML = "";

  if (results.length === 0) {
    resultsList.innerHTML = "<li>No matches found.</li>";
    return;
  }

  let groupedTickets = {};
  results.forEach((ticket) => {
    if (!groupedTickets[ticket.name]) {
      groupedTickets[ticket.name] = [];
    }
    groupedTickets[ticket.name].push(ticket);
  });

  for (let name in groupedTickets) {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
      <strong onclick="toggleTickets('${name.replace(
        /'/g,
        "\\'"
      )}')">${name}</strong>
      <span class="expand-icon">▶</span>
    `;
    resultsList.appendChild(listItem);
  }
}

// 🔹 Open Ticket Modal
window.toggleTickets = function (name) {
  const modal = document.getElementById("ticketModal");
  const modalTitle = document.getElementById("modalGuestName");
  const modalList = document.getElementById("modalTicketList");
  const checkInAllBtn = document.getElementById("checkInAllBtn");

  modalTitle.textContent = `Tickets for ${name}`;
  let guestTickets = results.filter((ticket) => ticket.name === name);

  // Check if all tickets are already checked in
  let allCheckedIn = guestTickets.every((ticket) => ticket.checkedIn);
  checkInAllBtn.textContent = allCheckedIn
    ? "🔴 Check Out All"
    : "✅ Check In All";

  modalList.innerHTML = "";
  guestTickets.forEach((ticket) => {
    let ticketItem = document.createElement("li");
    ticketItem.innerHTML = `
      🎟️ Row ${ticket.rowNumber}, Seat ${ticket.seatNumber} 
      <button id="ticket-${ticket.id}" onclick="toggleCheckIn('${
      ticket.id
    }', this)">
        ${ticket.checkedIn ? "🔴 Check Out" : "✅ Check In"}
      </button>
    `;
    modalList.appendChild(ticketItem);
  });

  modal.style.display = "block";
};

// 🔹 Close Modal
window.closeModal = function () {
  document.getElementById("ticketModal").style.display = "none";
};

// 🔹 Toggle Check-In/Check-Out
window.toggleCheckIn = async function (ticketID, button) {
  if (!eventID) return;

  const ticketRef = doc(db, eventID, ticketID);
  const ticketSnap = await getDoc(ticketRef);

  if (!ticketSnap.exists()) {
    alert("❌ Ticket not found!");
    return;
  }

  let ticketData = ticketSnap.data();
  let newStatus = !ticketData.checkedIn;

  await updateDoc(ticketRef, { checkedIn: newStatus });

  button.textContent = newStatus ? "🔴 Check Out" : "✅ Check In";
  alert(
    `✅ ${ticketData.name} is now ${newStatus ? "Checked In" : "Checked Out"}!`
  );

  // Update "Check In All" button text
  let guestTickets = results.filter(
    (ticket) => ticket.name === ticketData.name
  );
  let allCheckedIn = guestTickets.every((ticket) => ticket.checkedIn);
  document.getElementById("checkInAllBtn").textContent = allCheckedIn
    ? "🔴 Check Out All"
    : "✅ Check In All";
};

// 🔹 Check In/Out All Tickets for Guest
document
  .getElementById("checkInAllBtn")
  .addEventListener("click", async function () {
    const userName = document
      .getElementById("modalGuestName")
      .textContent.replace("Tickets for ", "")
      .trim();
    if (!userName) {
      alert("No user selected.");
      return;
    }

    const guestTickets = results.filter((ticket) => ticket.name === userName);
    if (guestTickets.length === 0) {
      alert("No tickets found for this guest.");
      return;
    }

    const allCheckedIn = guestTickets.every((ticket) => ticket.checkedIn);
    const newStatus = !allCheckedIn;

    if (
      !confirm(
        `Are you sure you want to ${
          newStatus ? "check in" : "check out"
        } all tickets for ${userName}?`
      )
    ) {
      return;
    }

    let batch = writeBatch(db);
    guestTickets.forEach((ticket) => {
      batch.update(doc(db, eventID, ticket.id), { checkedIn: newStatus });
    });

    try {
      await batch.commit();
      alert(
        `✅ Successfully ${
          newStatus ? "checked in" : "checked out"
        } all tickets for ${userName}!`
      );

      // Update button text
      document.getElementById("checkInAllBtn").textContent = newStatus
        ? "🔴 Check Out All"
        : "✅ Check In All";

      // Update individual ticket buttons
      guestTickets.forEach((ticket) => {
        let button = document.getElementById(`ticket-${ticket.id}`);
        if (button) {
          button.textContent = newStatus ? "🔴 Check Out" : "✅ Check In";
        }
      });
    } catch (error) {
      alert("❌ Error updating tickets.");
    }
  });

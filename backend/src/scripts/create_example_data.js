const { recreateDatabase } = require("../config/database");

const UserModel = require("../models/user.model");
const ReportModel = require("../models/report.model");
const ReportImagesModel = require("../models/report-images.model");
const LostItemModel = require("../models/lost-item.model");
const NoteModel = require("../models/note.model");
const PersonalDetailsModel = require("../models/personal-details.model");
const AlertModel = require("../models/alert.model");
const AUTO_GENERATED_EMAIL = "appliedprojectecu@gmail.com";

async function resetDatabase() {
  await recreateDatabase();

  const models = [
    UserModel,
    ReportModel,
    ReportImagesModel,
    LostItemModel,
    NoteModel,
    PersonalDetailsModel,
    AlertModel,
  ];

  await Promise.all(
    models.map(async (model) => {
      if (model.initialized) {
        model.initialized = false;
      }

      if (typeof model.initialize === "function") {
        await model.initialize();
      }
    }),
  );
}

const failures = {
  [UserModel.table]: 0,
  [ReportModel.table]: 0,
  [ReportImagesModel.table]: 0,
  [LostItemModel.table]: 0,
  [NoteModel.table]: 0,
  [PersonalDetailsModel.table]: 0,
  [AlertModel.table]: 0,
};

async function trySave(model, collection, MODEL = null) {
  try {
    await model.save();
    collection.push(model);
  } catch (error) {
    if (MODEL) {
      failures[MODEL.table]++;
    }
    console.error(`Failed to save ${MODEL?.table ?? model.constructor.name}`, error);
  }
}

const citizens = [
  {
    username: "maria.lopez",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "Maria",
    lastName: "Lopez",
  },
  {
    username: "james.edwards",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "James",
    lastName: "Edwards",
  },
  {
    username: "aaliyah.chen",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "Aaliyah",
    lastName: "Chen",
  },
  {
    username: "noah.patel",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "Noah",
    lastName: "Patel",
  },
  {
    username: "sofia.martin",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "Sofia",
    lastName: "Martin",
  },
  {
    username: "oliver.kim",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "Oliver",
    lastName: "Kim",
  },
];

const officers = [
  {
    username: "OF-201",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "Elena",
    lastName: "Hughes",
  },
  {
    username: "OF-305",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "Rohan",
    lastName: "Singh",
  },
  {
    username: "OF-442",
    password: "Guardian!234",
    email: AUTO_GENERATED_EMAIL,
    firstName: "Priya",
    lastName: "Nair",
  },
];

const incidentTemplates = [
  {
    reference: "traffic-hazard",
    citizen: "maria.lopez",
    description: `[Safety] Traffic hazard at Main & 3rd\n\nTwo vehicles collided at the Main St & 3rd Ave intersection leaving oil across the eastbound lane. Residents report queues stretching back three blocks.\n\nRequested response:\n• Set up a temporary detour for eastbound traffic\n• Notify road maintenance about the spill\n• Request tow support for both vehicles`,
    longitude: 151.2076,
    latitude: -33.8679,
    priority: 85,
    status: "PENDING",
    notes: [
      {
        subject: "Call intake",
        content: "Report logged at 14:05 after multiple calls from nearby businesses.",
      },
      {
        subject: "Dispatch",
        content: "Unit Bravo-12 en route to manage the intersection until tow services arrive.",
      },
    ],
    witnesses: ["Evelyn Grant", "Marcus Reid"],
  },
  {
    reference: "park-noise",
    citizen: "james.edwards",
    description: `[Community] Noise complaint at Riverside Park\n\nLive music from the Riverside twilight market has exceeded the approved volume. Families nearby report loud bass past quiet hours. Market organiser on-site and cooperative.\n\nRequested response:\n• Confirm permit conditions with organiser\n• Conduct a sound check and record measurements\n• Provide written reminder about the 9pm cut-off`,
    longitude: 151.1954,
    latitude: -33.8702,
    priority: 35,
    status: "IN-PROGRESS",
    notes: [
      {
        subject: "Community liaison",
        content: "Officer on scene speaking with the event manager to reduce speaker volume.",
      },
    ],
    witnesses: ["Jordan Mills"],
  },
  {
    reference: "suspicious-package",
    citizen: "aaliyah.chen",
    description: `[Safety] Suspicious package near Central Library\n\nUnattended backpack spotted beside the north entrance of Central Library. Security footage shows it was placed at 16:42 and no one has returned. Library staff have cleared the foyer.\n\nRequested response:\n• Secure a 30 metre perimeter\n• Notify bomb response for assessment\n• Share update with library operations`,
    longitude: 151.2091,
    latitude: -33.8673,
    priority: 92,
    status: "IN-PROGRESS",
    notes: [
      {
        subject: "Perimeter established",
        content: "Patrol Alpha-02 closed foot traffic and awaiting specialist attendance.",
      },
      {
        subject: "CCTV review",
        content: "Video clip exported showing unknown adult leaving the item at 16:42.",
      },
    ],
    witnesses: ["Library Security", "Nora Fleming"],
  },
  {
    reference: "streetlight-outage",
    citizen: "noah.patel",
    description: `[Maintenance] Streetlight outage on Palmer Ave\n\nThree consecutive streetlights are out between house numbers 48 and 60. Area is a known pedestrian corridor with limited passive surveillance.\n\nRequested response:\n• Log maintenance ticket with utilities team\n• Increase patrol visibility until lighting restored`,
    longitude: 151.2148,
    latitude: -33.8721,
    priority: 25,
    status: "COMPLETED",
    notes: [
      {
        subject: "Utilities ticket",
        content: "Maintenance request #58421 lodged with repair ETA of 48 hours.",
      },
    ],
    witnesses: [],
  },
  {
    reference: "graffiti-laneway",
    citizen: "sofia.martin",
    description: `[Community] Graffiti reported in Wattle Laneway\n\nFresh tagging observed across five roller doors and waste collection bins. CCTV in the laneway has been offline since last month.\n\nRequested response:\n• Capture photos for records\n• Notify cleansing services\n• Speak with business owners about camera repairs`,
    longitude: 151.2038,
    latitude: -33.8661,
    priority: 48,
    status: "PENDING",
    notes: [
      {
        subject: "Business contact",
        content: "Owner of 12 Wattle Ln confirmed camera technician booked for Friday.",
      },
    ],
    witnesses: ["Priya Bhat"],
  },
  {
    reference: "missing-person-sighting",
    citizen: "oliver.kim",
    description: `[Safety] Possible sighting of missing teenager\n\nResident believes they saw missing person Amber Doyle near the Harbour Walk tram stop at 18:05. Individual appeared disoriented but matched police social media post.\n\nRequested response:\n• Circulate description to patrol units\n• Review transport CCTV covering the stop\n• Share update with investigating officer`,
    longitude: 151.2106,
    latitude: -33.8735,
    priority: 78,
    status: "PENDING",
    notes: [
      {
        subject: "Follow-up call",
        content: "Caller available for statement until 22:00 if required.",
      },
    ],
    witnesses: ["Daniel Hargreaves"],
  },
];

const lostItemTemplates = [
  {
    citizen: "maria.lopez",
    name: "Leather wallet",
    description: "Brown leather wallet containing ID, transit pass and emergency contact card.",
    serial: "WAL-2045",
    color: "Brown",
    model: "Bi-fold wallet",
    longitude: 151.2063,
    latitude: -33.8682,
    status: "PENDING",
    branch: "Central Community Desk",
    notes: [
      {
        subject: "Report received",
        content: "Caller last used the wallet at 12:20 while boarding the light rail at Bayfront.",
      },
    ],
    contacts: [
      { name: "Maria Lopez", contact: "+61 400 200 145" },
    ],
  },
  {
    citizen: "james.edwards",
    name: "Sports duffel bag",
    description: "Navy duffel with council swim team logo. Contains training gear and access card.",
    serial: "DUF-8831",
    color: "Navy",
    model: "MetroActive",
    longitude: 151.2121,
    latitude: -33.8713,
    status: "INVESTIGATING",
    branch: "Riverside Station",
    notes: [
      {
        subject: "Station follow-up",
        content: "Station staff checking CCTV between 17:30 and 18:00 for unattended bags.",
      },
    ],
    contacts: [
      { name: "James Edwards", contact: "+61 430 888 903" },
    ],
  },
  {
    citizen: "aaliyah.chen",
    name: "Tablet device",
    description: "Silver tablet in a navy case with council badge engraving on rear panel.",
    serial: "TAB-5502",
    color: "Silver",
    model: "MetroTab 11",
    longitude: 151.1994,
    latitude: -33.8649,
    status: "FOUND",
    branch: "Civic Square Station",
    notes: [
      {
        subject: "Item secured",
        content: "Security logged tablet in property locker #12 awaiting ownership confirmation.",
      },
    ],
    contacts: [
      { name: "Facilities Desk", contact: "+61 421 765 333" },
    ],
  },
  {
    citizen: "sofia.martin",
    name: "House keys",
    description: "Set of three keys with yellow lanyard and gym barcode tag.",
    serial: "KEY-7310",
    color: "Silver",
    model: "Keyring",
    longitude: 151.214,
    latitude: -33.8697,
    status: "CLOSED",
    branch: "Harbour Walk Station",
    notes: [
      {
        subject: "Owner confirmed",
        content: "Keys collected after identity verification at 09:45.",
      },
    ],
    contacts: [
      { name: "Station Desk", contact: "+61 410 908 221" },
    ],
  },
];

const alertTemplates = [
  {
    title: "Heatwave warning for tomorrow",
    description: "Temperatures expected above 38°C between 11:00 and 17:00. Check on vulnerable residents and ensure hydration points are stocked.",
    type: "weather",
  },
  {
    title: "Harbour Walk tram disruption",
    description: "Service paused between Harbour Walk and Civic Square after overhead line fault. Replacement buses in operation every 20 minutes.",
    type: "transport",
  },
  {
    title: "Community safety forum tonight",
    description: "Join the 6:30pm forum at Riverside Hall to discuss recent safety initiatives and hear from local officers.",
    type: "community",
  },
  {
    title: "Lost person alert cancelled",
    description: "Amber Doyle has been located safe. Thank you to the community for assistance and information.",
    type: "update",
  },
  {
    title: "Storm clean-up volunteers needed",
    description: "Council is coordinating debris removal on Saturday morning. Register interest with the community desk by Friday.",
    type: "community",
  },
];

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: "" };
  }
  const last = parts.pop();
  return { first: parts.join(" "), last: last ?? "" };
}

async function createUsers() {
  console.info("Creating citizens");
  const users = [];
  const credentials = [];

  for (const citizen of citizens) {
    const user = new UserModel(
      citizen.username,
      DEFAULT_ACCOUNT_EMAIL,
      citizen.password,
      citizen.firstName,
      citizen.lastName,
      0,
    );
    await trySave(user, users, UserModel);
    credentials.push({ username: user.username, password: citizen.password });
  }

  console.table(credentials, ["username", "password"]);
  return users;
}

async function createOfficers() {
  console.info("Creating officers");
  const officersCreated = [];
  const credentials = [];

  for (const officer of officers) {
    const user = new UserModel(
      officer.username,
      DEFAULT_ACCOUNT_EMAIL,
      officer.password,
      officer.firstName,
      officer.lastName,
      1,
    );
    await trySave(user, officersCreated, UserModel);
    credentials.push({ username: user.username, password: officer.password });
  }

  console.table(credentials, ["username", "password"]);
  return officersCreated;
}

function findUserByUsername(users, username) {
  const user = users.find((candidate) => candidate.username === username);

  if (!user) {
    throw new Error(
      `Unable to locate user "${username}" while generating example data. Did user creation fail?`,
    );
  }

  return user;
}

async function createReports(users) {
  console.info("Creating incident reports");
  const reports = [];

  for (const template of incidentTemplates) {
    const citizen = findUserByUsername(users, template.citizen);
    const report = new ReportModel(
      template.description,
      template.longitude,
      template.latitude,
      citizen.id,
      template.priority,
    );
    report.status = template.status;

    await trySave(report, reports, ReportModel);
    report.template = template;
  }

  return reports;
}

async function createReportNotes(reports) {
  console.info("Creating report notes");
  const notes = [];

  for (const report of reports) {
    const templateNotes = report.template?.notes ?? [];
    for (const note of templateNotes) {
      const reportNote = new NoteModel(
        note.subject,
        note.content,
        report.id,
        "report",
      );
      await trySave(reportNote, notes, NoteModel);
    }
  }

  return notes;
}

async function createReportWitnesses(reports) {
  console.info("Saving report witnesses");
  const witnesses = [];

  for (const report of reports) {
    const templateWitnesses = report.template?.witnesses ?? [];
    for (const witnessName of templateWitnesses) {
      const witness = new PersonalDetailsModel(
        witnessName,
        "",
        null,
        null,
      );
      witness.attachToReport(report.id);
      await trySave(witness, witnesses, PersonalDetailsModel);
    }
  }

  return witnesses;
}

async function createLostItems(users) {
  console.info("Creating lost item reports");
  const lostItems = [];

  for (const template of lostItemTemplates) {
    const citizen = findUserByUsername(users, template.citizen);
    const lostItem = new LostItemModel(
      template.name,
      template.description,
      template.serial,
      template.color,
      template.model,
      template.longitude,
      template.latitude,
      template.status,
      template.branch,
      citizen.id,
    );

    await trySave(lostItem, lostItems, LostItemModel);
    lostItem.template = template;
  }

  return lostItems;
}

async function createLostItemNotes(lostItems) {
  console.info("Creating lost item notes");
  const notes = [];

  for (const lostItem of lostItems) {
    const templateNotes = lostItem.template?.notes ?? [];
    for (const note of templateNotes) {
      const lostNote = new NoteModel(
        note.subject,
        note.content,
        lostItem.id,
        "lost_article",
      );
      await trySave(lostNote, notes, NoteModel);
    }
  }

  return notes;
}

async function createLostItemContacts(lostItems) {
  console.info("Linking contacts to lost items");
  const contacts = [];

  for (const lostItem of lostItems) {
    const templateContacts = lostItem.template?.contacts ?? [];
    for (const contact of templateContacts) {
      const split = splitName(contact.name);
      const personalDetail = new PersonalDetailsModel(
        split.first,
        split.last,
        null,
        contact.contact,
      );
      personalDetail.attachToLostArticle(lostItem.id);
      await trySave(personalDetail, contacts, PersonalDetailsModel);
    }
  }

  return contacts;
}

async function createAlerts() {
  console.info("Creating alerts");
  const alerts = [];

  for (const alert of alertTemplates) {
    const alertModel = new AlertModel(
      alert.title,
      alert.description,
      alert.type,
    );
    await trySave(alertModel, alerts, AlertModel);
  }

  return alerts;
}

async function run() {
  await resetDatabase();
  const users = await createUsers();
  await createOfficers();
  const reports = await createReports(users);
  await createReportNotes(reports);
  await createReportWitnesses(reports);
  const lostItems = await createLostItems(users);
  await createLostItemNotes(lostItems);
  await createLostItemContacts(lostItems);
  await createAlerts();

  console.info("------------------------------FAILURES------------------------------");
  console.table(failures);
}

run().catch((error) => {
  console.error("Example data generation failed", error);
  process.exitCode = 1;
});

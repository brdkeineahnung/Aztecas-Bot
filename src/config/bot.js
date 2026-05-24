import { logger } from '../utils/logger.js';

export const botConfig = {
  // =========================
  // BOT PRESENCE (what users see under the bot name)
  // =========================
  presence: {
    // Current online state shown on Discord ("online", "idle", "dnd", "invisible")
    status: "online",

    // Activity lines shown under the bot name.
    // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching, 4 = Custom, 5 = Competing
    activities: [
      {
        name: "Aztecas is The Hood🩵",
        type: 2, // 2 = Listening
      },
    ],
  },

  // =========================
  // COMMAND BEHAVIOR
  // =========================
  commands: {
    owners: process.env.OWNER_IDS?.split(",") || [],
    defaultCooldown: 3, 
    deleteCommands: false,
    testGuildId: process.env.TEST_GUILD_ID,
  },

  // =========================
  // APPLICATIONS SYSTEM (Fraktions-Bewerbungen)
  // =========================
  applications: {
    defaultQuestions: [
      { question: "Wie heißt du Reallife / Ingame?", required: true },
      { question: "Wie alt bist du?", required: true },
      { question: "Warum möchtest du gerade den Aztecas beitreten?", required: true },
      { question: "Bringe eine kurze Übersicht deiner bisherigen Fraktionserfahrung mit.", required: true },
    ],

    embedColors: {
      pending: "#FFA500", // Orange für offene Bewerbungen
      approved: "#00FF00", // Grün für Angenommen
      denied: "#FF0000", // Rot für Abgelehnt
    },

    applicationCooldown: 24, 
    deleteDeniedAfter: 7, 
    deleteApprovedAfter: 30, 
    managerRoles: [], 
  },

  // =========================
  // EMBED COLORS & BRANDING
  // =========================
  embeds: {
    colors: {
      // Hauptfarben im Aztecas-Stil
      primary: "#00F0FF",   // Knalliges Fraktions-Türkis
      secondary: "#1A2E33", // Edles, dunkles Cyan-Grau für Kontraste

      // Standard Status-Farben
      success: "#00FF87",  // Frisches Grün
      error: "#FF3B30",    // Klares Rot
      warning: "#FFCC00",  // Signal-Gelb
      info: "#00A3FF",     // Informations-Blau

      // Neutrale Farb-Palette
      light: "#FFFFFF",
      dark: "#0F1115",
      gray: "#6E848C",

      // Shortcuts im Türkis/Dark-Schema überschrieben
      blurple: "#00D1FF",
      green: "#00FF87",
      yellow: "#FFCC00",
      fuchsia: "#E91E63",
      red: "#FF3B30",
      black: "#000000",

      // Feature-spezifische Farben
      giveaway: {
        active: "#00F0FF",
        ended: "#6E848C",
      },
      ticket: {
        open: "#00FF87",
        claimed: "#FFCC00",
        closed: "#FF3B30",
        pending: "#6E848C",
      },
      economy: "#00F0FF",
      birthday: "#E91E63",
      moderation: "#FF3B30",

      // Ticket-Prioritäten farblich abgestuft
      priority: {
        none: "#6E848C",
        low: "#00A3FF",
        medium: "#00FF87",
        high: "#FFCC00",
        urgent: "#FF3B30",
      },
    },
    footer: {
      text: "Aztecas Bot • Management System",
      icon: null, // Hier kannst du eine URL zu eurem Fraktionslogo eintragen
    },
    thumbnail: null,
    author: {
      name: "VIVE LES AZTECAS",
      icon: null,
      url: null,
    },
  },

  // =========================
  // ECONOMY SETTINGS (In-Game Währung für kleine Spielereien)
  // =========================
  economy: {
    currency: {
      name: "Schwarzgeld",
      namePlural: "Schwarzgeld",
      symbol: "💵",
    },
    startingBalance: 250,
    baseBankCapacity: 500000,
    dailyAmount: 250,
    workMin: 50,
    workMax: 250,
    begMin: 10,
    begMax: 80,
    robSuccessRate: 0.45,
    robFailJailTime: 1800000, // 30 Minuten Knast bei Fehlversuch
  },

  shop: {},

  // =========================
  // TICKET SYSTEM (Support-Bereich)
  // =========================
  tickets: {
    defaultCategory: null,
    supportRoles: [],
    priorities: {
      none: { emoji: "⚪", color: "#6E848C", label: "Normal" },
      low: { emoji: "🟢", color: "#00A3FF", label: "Frage" },
      medium: { emoji: "🟡", color: "#00FF87", label: "Beschwerde" },
      high: { emoji: "🔴", color: "#FFCC00", label: "Wichtig" },
      urgent: { emoji: "🚨", color: "#FF3B30", label: "Fraktions-Notfall" },
    },
    defaultPriority: "none",
    archiveCategory: null,
    logChannel: null,
  },

  giveaways: {
    defaultDuration: 86400000, 
    minimumWinners: 1,
    maximumWinners: 10,
    minimumDuration: 300000, 
    maximumDuration: 2592000000, 
    allowedRoles: [],
    bypassRoles: [],
  },

  birthday: {
    defaultRole: null,
    announcementChannel: null,
    timezone: "Europe/Berlin", // Auf deutsche Zeitzone umgestellt
  },

  // =========================
  // VERIFICATION SETTINGS
  // =========================
  verification: {
    defaultMessage: "Willkommen im Barrio! Klicke unten auf den Button, um dich zu verifizieren und Zugriff auf die internen Kanäle der Aztecas zu erhalten.",
    defaultButtonText: "Verifizieren 🩵",
    autoVerify: {
      defaultCriteria: "none",
      defaultAccountAgeDays: 3,
      serverSizeThreshold: 1000,
      minAccountAge: 1,      
      maxAccountAge: 365,    
      sendDMNotification: true,
      criteria: {
        account_age: "Account-Alter überprüfen",
        server_size: "Automatisch freigeben",
        none: "Sofortiger Zutritt"
      }
    },
    verificationCooldown: 5000,  
    maxVerificationAttempts: 3,   
    attemptWindow: 60000,          
    maxCooldownEntries: 10000,
    maxAttemptEntries: 10000,
    cooldownCleanupInterval: 300000, 
    maxAuditMetadataBytes: 4096,
    maxInMemoryAuditEntries: 1000,
    logAllVerifications: true,
    keepAuditTrail: true,
  },

  // =========================
  // WELCOME / GOODBYE MESSAGES
  // =========================
  welcome: {
    defaultWelcomeMessage:
      "¡Hola! {user} hat den Weg ins Barrio der Aztecas gefunden. Wir sind nun {memberCount} Locos!",
    defaultGoodbyeMessage:
      "{user} hat das Barrio verlassen. Wir sind verbleibende {memberCount} Mitglieder.",
    defaultWelcomeChannel: null,
    defaultGoodbyeChannel: null,
  },

  // =========================
  // COUNTER CHANNELS
  // =========================
  counters: {
    defaults: {
      name: "{name} Zähler",
      description: "Aztecas {name} Zähler",
      type: "voice",
      channelName: "{name}: {count}",
    },
    permissions: {
      deny: ["VIEW_CHANNEL"],
      allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK"],
    },
    messages: {
      created: "✅ Counter **{name}** wurde im Barrio eingerichtet.",
      deleted: "🗑️ Counter **{name}** wurde abgerissen.",
      updated: "🔄 Counter **{name}** aktualisiert.",
    },
    types: {
      members: {
        name: "🩵 Gesamte Einwohner",
        description: "Alle User auf dem Discord",
        getCount: (guild) => guild.memberCount.toString(),
      },
      bots: {
        name: "🤖 Techniker",
        description: "Bot-Accounts im System",
        getCount: (guild) => guild.members.cache.filter((m) => m.user.bot).size.toString(),
      },
      members_only: {
        name: "👥 Aktive Locos",
        description: "Echte Fraktionsmitglieder/User",
        getCount: (guild) => guild.members.cache.filter((m) => !m.user.bot).size.toString(),
      },
    },
  },

  messages: {
    noPermission: "Dafür hast du keine Rechte, Amigo.",
    cooldownActive: "Mach mal langsam. Warte bitte noch {time}, bevor du den Befehl erneut nutzt.",
    errorOccurred: "Da ist ein Fehler unterlaufen. Sag dem Management Bescheid!",
    missingPermissions: "Mir fehlen die nötigen Discord-Rechte, um das zu tun.",
    commandDisabled: "Dieser Befehl wurde vom Management deaktiviert.",
    maintenanceMode: "Der Bot macht gerade eine Siesta (Wartungsmodus).",
  },

  features: {
    economy: true,
    leveling: true,
    moderation: true,
    logging: true,
    welcome: true,
    tickets: true,
    giveaways: true,
    birthday: false, // Für FiveM Fraktionen meistens unwichtig
    counter: true,
    verification: true,
    reactionRoles: true,
    joinToCreate: true,
    voice: true,
    search: false,
    tools: true,
    utility: true,
    community: true,
    fun: true,
  },
};

export function validateConfig(config) {
  const errors = [];
  
  if (process.env.NODE_ENV !== 'production') {
    logger.debug('Environment variables check:');
    logger.debug('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
    logger.debug('TOKEN exists:', !!process.env.TOKEN);
    logger.debug('CLIENT_ID exists:', !!process.env.CLIENT_ID);
    logger.debug('GUILD_ID exists:', !!process.env.GUILD_ID);
    logger.debug('POSTGRES_HOST exists:', !!process.env.POSTGRES_HOST);
    logger.debug('NODE_ENV:', process.env.NODE_ENV);
  }

  if (!process.env.DISCORD_TOKEN && !process.env.TOKEN) {
    errors.push("Bot token is required (DISCORD_TOKEN or TOKEN environment variable)");
  }
  if (!process.env.CLIENT_ID) {
    errors.push("Client ID is required (CLIENT_ID environment variable)");
  }  
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.POSTGRES_HOST) errors.push("PostgreSQL host is required in production (POSTGRES_HOST environment variable)");
    if (!process.env.POSTGRES_USER) errors.push("PostgreSQL user is required in production (POSTGRES_USER environment variable)");
    if (!process.env.POSTGRES_PASSWORD) errors.push("PostgreSQL password is required in production (POSTGRES_PASSWORD environment variable)");
  }

  return errors;
}

const configErrors = validateConfig(botConfig);
if (configErrors.length > 0) {
  logger.error("Bot configuration errors:", configErrors.join("\n"));
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

export const BotConfig = botConfig;

export function getColor(path, fallback = "#00F0FF") {
  if (typeof path === "number") return path;
  if (typeof path === "string" && path.startsWith("#")) {
    return parseInt(path.replace("#", ""), 16);
  }
  const result = path
    .split(".")
    .reduce(
      (obj, key) => (obj && obj[key] !== undefined ? obj[key] : fallback),
      botConfig.embeds.colors,
    );
  
  if (typeof result === "string" && result.startsWith("#")) {
    return parseInt(result.replace("#", ""), 16);
  }
  return result;
}

export function getRandomColor() {
  const colors = Object.values(botConfig.embeds.colors).flatMap((color) =>
    typeof color === "string" ? color : Object.values(color),
  );
  return colors[Math.floor(Math.random() * colors.length)];
}

export default botConfig;

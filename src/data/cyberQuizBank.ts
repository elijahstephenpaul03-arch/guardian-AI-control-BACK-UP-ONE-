export type QuizCategory = 
  | "password_security"
  | "phishing"
  | "social_privacy"
  | "cyberbullying"
  | "gaming_scams"
  | "ai_deepfakes"
  | "personal_info"
  | "digital_footprint"
  | "safe_downloads"
  | "stranger_safety";

export interface QuizOption {
  text: string;
  isCorrect: boolean;
  unsafeReason?: string;
}

export interface FollowUpQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  quickExplanation: string;
}

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  categoryLabel: string;
  difficulty: 1 | 2 | 3; // 1 = Beginner, 2 = Intermediate, 3 = Advanced
  question: string;
  options: QuizOption[];
  explanation: {
    whyCorrectSafe: string;
    otherOptionsUnsafe: string;
    realWorldExample: string;
    followUpQuestion: FollowUpQuestion;
  };
}

export const CATEGORY_LABELS: Record<QuizCategory, string> = {
  password_security: "Password Security",
  phishing: "Phishing & Fake Websites",
  social_privacy: "Social Media Privacy",
  cyberbullying: "Cyberbullying & Kindness",
  gaming_scams: "Online Gaming Scams",
  ai_deepfakes: "AI Safety & Deepfakes",
  personal_info: "Personal Info Protection",
  digital_footprint: "Digital Footprint",
  safe_downloads: "Safe Downloads & Malware",
  stranger_safety: "Online Stranger Safety"
};

export const CYBER_QUIZ_BANK: QuizQuestion[] = [
  // ==========================================
  // 1. PASSWORD SECURITY (5 Questions)
  // ==========================================
  {
    id: "PW-01",
    category: "password_security",
    categoryLabel: "Password Security",
    difficulty: 1,
    question: "What makes a password strong and tough for hackers to crack?",
    options: [
      { text: "Using your pet's name or your birthday so it is easy to remember.", isCorrect: false, unsafeReason: "Birthdays and pet names are public information on social media." },
      { text: "A mix of uppercase letters, lowercase letters, numbers, and symbols at least 12 characters long.", isCorrect: true },
      { text: "Using '12345678' or 'password' because simple is best.", isCorrect: false, unsafeReason: "These are the first passwords automated cracking bots attempt." }
    ],
    explanation: {
      whyCorrectSafe: "Complex passwords with 12+ mixed characters take computers centuries to brute-force.",
      otherOptionsUnsafe: "Simple words or personal facts can be guessed in under a second.",
      realWorldExample: "A password like 'B1ue#D0lph1n!98' is 100,000x harder to guess than 'oliver2014'.",
      followUpQuestion: {
        question: "Should you write your master password on a sticky note attached to your screen?",
        options: ["Yes, so you never forget it.", "No, anyone walking by could see it.", "Only if written backwards."],
        correctIndex: 1,
        quickExplanation: "Physical security matters as much as digital security."
      }
    }
  },
  {
    id: "PW-02",
    category: "password_security",
    categoryLabel: "Password Security",
    difficulty: 1,
    question: "Your best friend asks for your Roblox or Minecraft password so they can build a shared base while you are away. What should you do?",
    options: [
      { text: "Give it to them since you trust them like family.", isCorrect: false, unsafeReason: "Even close friends can accidentally leak or get their devices hacked." },
      { text: "Politely say no; passwords are meant to be kept private between you and your parents.", isCorrect: true },
      { text: "Change it to something simple, share it, and change it back later.", isCorrect: false, unsafeReason: "Accounts can be compromised or banned instantly if shared." }
    ],
    explanation: {
      whyCorrectSafe: "Keeping passwords confidential ensures only you and your trusted guardians have account access.",
      otherOptionsUnsafe: "Sharing credentials violates game terms of service and risks loss of skins, items, or account bans.",
      realWorldExample: "Many kids lose years of earned game progress when friends accidentally type credentials on compromised school tablets.",
      followUpQuestion: {
        question: "Who is the ONLY person you should ever share your passwords with?",
        options: ["Your gaming buddy", "Your parent or legal guardian", "A friendly online moderator"],
        correctIndex: 1,
        quickExplanation: "Parents help you manage and recover accounts safely."
      }
    }
  },
  {
    id: "PW-03",
    category: "password_security",
    categoryLabel: "Password Security",
    difficulty: 2,
    question: "You use the same password for your school email, gaming accounts, and social media. Why is this considered dangerous?",
    options: [
      { text: "If one website has a data breach, hackers will unlock all your other accounts instantly.", isCorrect: true },
      { text: "It uses up too much internet bandwidth on your home router.", isCorrect: false, unsafeReason: "Password reuse has zero connection to network bandwidth." },
      { text: "Websites charge extra monthly fees for using identical passwords.", isCorrect: false, unsafeReason: "Websites never charge fees based on password similarity." }
    ],
    explanation: {
      whyCorrectSafe: "Using unique passwords isolates security incidents so a breach on one site doesn't cascade.",
      otherOptionsUnsafe: "Credential stuffing bots automatically test leaked password pairs across thousands of top services.",
      realWorldExample: "When a small gaming forum was breached in 2024, attackers unlocked thousands of players' main email accounts because passwords matched.",
      followUpQuestion: {
        question: "What is the best tool to remember dozens of different, complex passwords?",
        options: ["A password manager", "Writing them on paper in your backpack", "Texting them to yourself"],
        correctIndex: 0,
        quickExplanation: "Encrypted password managers generate and store unique credentials securely."
      }
    }
  },
  {
    id: "PW-04",
    category: "password_security",
    categoryLabel: "Password Security",
    difficulty: 2,
    question: "What is Two-Factor Authentication (2FA) and why should you enable it?",
    options: [
      { text: "A feature that makes you enter two passwords you invented yourself.", isCorrect: false, unsafeReason: "Two passwords from memory is not true two-factor authentication." },
      { text: "A second verification step, like a mobile code or security prompt, ensuring nobody can log in with just your password.", isCorrect: true },
      { text: "A software backup that deletes your account if you enter the wrong password twice.", isCorrect: false, unsafeReason: "2FA protects access, it does not delete accounts." }
    ],
    explanation: {
      whyCorrectSafe: "2FA requires something you know (password) plus something you have (trusted device token).",
      otherOptionsUnsafe: "Even if an attacker steals your password, they cannot breach your account without your physical second factor.",
      realWorldExample: "Major platforms like Google and Discord block over 99.9% of automated account hijacks when 2FA is active.",
      followUpQuestion: {
        question: "If you receive a 2FA notification on your tablet when you did NOT attempt to log in, what does it mean?",
        options: ["It is a fun game notification.", "Someone has your password and is trying to break in right now.", "Your battery is low."],
        correctIndex: 1,
        quickExplanation: "Change your password immediately if unexpected 2FA prompts appear."
      }
    }
  },
  {
    id: "PW-05",
    category: "password_security",
    categoryLabel: "Password Security",
    difficulty: 3,
    question: "You receive an urgent message from a Discord bot claiming your account was flagged for suspicious activity, directing you to verify your identity on 'discord-support-verify.net'. What is this attack?",
    options: [
      { text: "An authorized security audit by official Discord engineers.", isCorrect: false, unsafeReason: "Official platforms never message users via random bots or off-domain links." },
      { text: "A targeted phishing scam designed to steal your session tokens and bypass password security.", isCorrect: true },
      { text: "A regular server ping that harmlessly updates your connection speed.", isCorrect: false, unsafeReason: "It is a credential harvesting trap, not a connection ping." }
    ],
    explanation: {
      whyCorrectSafe: "Recognizing suspicious third-party verification domains prevents credential and token theft.",
      otherOptionsUnsafe: "Entering credentials into unverified domains hands complete control to attackers.",
      realWorldExample: "Attackers commonly register typosquat domains like 'disc0rd-nitro.gift' to trick teenagers into logging in.",
      followUpQuestion: {
        question: "Where should you go if you ever suspect an issue with your account?",
        options: ["Click the link in the direct message.", "Open the official app directly and check account settings.", "Ask strangers in the global chat."],
        correctIndex: 1,
        quickExplanation: "Always navigate directly through official platform menus."
      }
    }
  },

  // ==========================================
  // 2. PHISHING AND FAKE WEBSITES (6 Questions)
  // ==========================================
  {
    id: "PH-01",
    category: "phishing",
    categoryLabel: "Phishing & Fake Websites",
    difficulty: 1,
    question: "You get an email that says: 'YOU WON A FREE PLAYSTATION 5! Click here within 10 minutes to claim!' What is this?",
    options: [
      { text: "A genuine prize drawing you must hurry to claim.", isCorrect: false, unsafeReason: "Legitimate companies do not give expensive consoles to random emails with countdown clocks." },
      { text: "A phishing scam trying to rush you into clicking a malicious link.", isCorrect: true },
      { text: "A routine email test from your school computer teacher.", isCorrect: false, unsafeReason: "It is an external deceptive phishing lure." }
    ],
    explanation: {
      whyCorrectSafe: "Urgency ('10 minutes left!') and unbelievable rewards ('Free PS5') are textbook signs of phishing.",
      otherOptionsUnsafe: "Scammers use panic and excitement to make people act before thinking critically.",
      realWorldExample: "Clicking prize links often downloads keylogger malware or redirects to fake forms requesting credit cards.",
      followUpQuestion: {
        question: "What should you do with emails offering prizes for contests you never entered?",
        options: ["Reply asking for proof.", "Click the unsubscribe link.", "Delete the email and inform a parent."],
        correctIndex: 2,
        quickExplanation: "Never interact with unsolicited scam messages."
      }
    }
  },
  {
    id: "PH-02",
    category: "phishing",
    categoryLabel: "Phishing & Fake Websites",
    difficulty: 1,
    question: "Which of the following website addresses (URLs) is an official, secure domain?",
    options: [
      { text: "https://www.youtube.com/watch?v=123", isCorrect: true },
      { text: "http://you-tube-free-videos.download-now.biz", isCorrect: false, unsafeReason: "Notice the deceptive subdomain and strange .biz extension." },
      { text: "https://youtube.account-security-update.xyz", isCorrect: false, unsafeReason: "The actual domain is account-security-update.xyz, pretending to be YouTube." }
    ],
    explanation: {
      whyCorrectSafe: "The true domain appears right before the first single forward slash: 'youtube.com'.",
      otherOptionsUnsafe: "Scammers insert brand names into prefixes to disguise malicious host servers.",
      realWorldExample: "Looking at the root domain before the suffix (.com, .org, .edu) stops 95% of fake website tricks.",
      followUpQuestion: {
        question: "What does the padlock icon and 'https://' signify on a website?",
        options: ["The website content is 100% honest and cannot be a scam.", "The connection between your browser and the server is encrypted.", "The site was created by your government."],
        correctIndex: 1,
        quickExplanation: "HTTPS encrypts the transit pipe, but scammers can still set up fake HTTPS websites."
      }
    }
  },
  {
    id: "PH-03",
    category: "phishing",
    categoryLabel: "Phishing & Fake Websites",
    difficulty: 2,
    question: "An SMS text message from an unknown number says: 'FedEx: Your package delivery has an incorrect street number. Click bit.ly/3xPq9 to update.' You aren't expecting a package. What should you do?",
    options: [
      { text: "Click the shortened link to see what package it might be.", isCorrect: false, unsafeReason: "Shortened links hide malicious malware domains." },
      { text: "Text back asking: 'Who is this?'", isCorrect: false, unsafeReason: "Replying confirms your phone number is active to spam databases." },
      { text: "Do not click the link, block the number, and mention it to your parent.", isCorrect: true }
    ],
    explanation: {
      whyCorrectSafe: "This attack ('Smishing' / SMS Phishing) preys on curiosity. Ignoring and blocking prevents infection.",
      otherOptionsUnsafe: "Shortened URLs (like bit.ly) are frequently used to hide malicious APK downloads or credential harvesters.",
      realWorldExample: "Millions of automated delivery scam texts are sent daily during holiday shopping periods.",
      followUpQuestion: {
        question: "How can you safely check if a family package is really arriving?",
        options: ["Ask your parent directly or check the official postal tracking app.", "Click whatever link is in the text.", "Call random phone numbers."],
        correctIndex: 0,
        quickExplanation: "Verify through official channels, never via unsolicited links."
      }
    }
  },
  {
    id: "PH-04",
    category: "phishing",
    categoryLabel: "Phishing & Fake Websites",
    difficulty: 2,
    question: "You click a search result for your school portal, and the login page looks almost identical, but the URL is 'portal.myschoo1.net' (with the number 1 instead of the letter 'l'). What is this called?",
    options: [
      { text: "Typosquatting / clone phishing", isCorrect: true },
      { text: "An upgraded school server speed boost", isCorrect: false, unsafeReason: "Domain misspellings are deceptive attacker traps." },
      { text: "A harmless graphic glitch on your monitor", isCorrect: false, unsafeReason: "URL address text is rendered by the browser, not a monitor glitch." }
    ],
    explanation: {
      whyCorrectSafe: "Typosquatting swaps visually similar characters (like '1' for 'l' or '0' for 'o') to trick unsuspecting users.",
      otherOptionsUnsafe: "Typing school credentials into cloned sites allows attackers to access homework, grades, and private profiles.",
      realWorldExample: "Always bookmark frequently used portals rather than relying on search ads that might lead to spoofed mirrors.",
      followUpQuestion: {
        question: "What is the safest way to visit your school portal every day?",
        options: ["Google it and click the top sponsored ad.", "Save the verified address as a browser bookmark.", "Ask friends to send you links daily."],
        correctIndex: 1,
        quickExplanation: "Bookmarks guarantee you always land on the authentic URL."
      }
    }
  },
  {
    id: "PH-05",
    category: "phishing",
    categoryLabel: "Phishing & Fake Websites",
    difficulty: 3,
    question: "You receive an email that appears to come from your teacher's real email address. It contains an attached file 'Homework_Assignment.pdf.exe' and asks you to run it immediately. How do you assess this?",
    options: [
      { text: "Open it immediately because your teacher sent it.", isCorrect: false, unsafeReason: "Double file extensions ending in .exe are executable programs, not documents." },
      { text: "Do not open it; double extensions (.pdf.exe) disguise executable malware, and your teacher's account may be compromised.", isCorrect: true },
      { text: "Forward it to all your classmates so everyone has the assignment.", isCorrect: false, unsafeReason: "Forwarding spreads malware across your entire school network." }
    ],
    explanation: {
      whyCorrectSafe: "Windows often hides extensions; attackers name files '.pdf.exe' hoping students only see the '.pdf' part.",
      otherOptionsUnsafe: "Executable (.exe, .bat, .scr) files run arbitrary code that can install trojans and ransomware.",
      realWorldExample: "School email systems are often compromised by phishing, which attackers then use to spread trojans internally.",
      followUpQuestion: {
        question: "How should you verify an email attachment if the file extension looks suspicious?",
        options: ["Ask your teacher in class or in person before opening it.", "Just open it on a tablet instead.", "Ignore it and do not do your homework."],
        correctIndex: 0,
        quickExplanation: "Out-of-band verification (asking in person) confirms legitimate files."
      }
    }
  },
  {
    id: "PH-06",
    category: "phishing",
    categoryLabel: "Phishing & Fake Websites",
    difficulty: 3,
    question: "What is 'Spear Phishing' compared to regular phishing?",
    options: [
      { text: "Phishing emails that only target fishermen and outdoor stores.", isCorrect: false, unsafeReason: "The word 'spear' is a metaphor, not related to fishing gear." },
      { text: "A personalized, highly targeted scam that uses your real name, hobbies, and friend names to trick you.", isCorrect: true },
      { text: "A phishing message that deletes itself after 24 hours.", isCorrect: false, unsafeReason: "Spear phishing describes targeting precision, not message expiration." }
    ],
    explanation: {
      whyCorrectSafe: "Spear phishing uses scraped personal info (from Instagram or TikTok) to make fraudulent messages seem credible.",
      otherOptionsUnsafe: "Assuming personalized emails are automatically safe makes you vulnerable to sophisticated social engineering.",
      realWorldExample: "A scammer might write: 'Hey Leo, saw you scored two goals at soccer Saturday! Check out this team roster photo.'",
      followUpQuestion: {
        question: "How do spear-phishers find personal details about your life?",
        options: ["Public social media posts, bios, and open profiles.", "Magical mind reading.", "Through secret satellite cameras."],
        correctIndex: 0,
        quickExplanation: "Everything posted publicly can be weaponized in social engineering."
      }
    }
  },

  // ==========================================
  // 3. SOCIAL MEDIA PRIVACY (5 Questions)
  // ==========================================
  {
    id: "SP-01",
    category: "social_privacy",
    categoryLabel: "Social Media Privacy",
    difficulty: 1,
    question: "When setting up a social media profile, what account privacy setting is safest for kids and teens?",
    options: [
      { text: "Public, so you can get as many followers and viral likes as possible.", isCorrect: false, unsafeReason: "Public profiles expose your photos, daily routine, and comments to any stranger globally." },
      { text: "Private / Friends Only, where you must manually approve each person who follows you.", isCorrect: true },
      { text: "Shared with all friends-of-friends with location tagging permanently turned on.", isCorrect: false, unsafeReason: "Location tags broadcasting where you are in real-time creates physical safety hazards." }
    ],
    explanation: {
      whyCorrectSafe: "Private profiles restrict your posts, stories, and friends list to people you actually know and trust in the real world.",
      otherOptionsUnsafe: "Public accounts enable strangers to harvest photos, track routines, and target you with scams.",
      realWorldExample: "Setting your account to Private stops automated web crawlers from copying your personal pictures.",
      followUpQuestion: {
        question: "Should you accept follow requests from people you have never met in real life?",
        options: ["Only if their profile looks cool.", "No, only accept people you and your family personally know.", "Yes, to grow your follower count."],
        correctIndex: 1,
        quickExplanation: "Online strangers can pretend to be anyone using stolen photos."
      }
    }
  },
  {
    id: "SP-02",
    category: "social_privacy",
    categoryLabel: "Social Media Privacy",
    difficulty: 1,
    question: "You take a photo in front of your house wearing your school sports jersey. Is this safe to post publicly?",
    options: [
      { text: "Yes, it shows school spirit and looks great.", isCorrect: false, unsafeReason: "The photo reveals your house address, school name, and team identity." },
      { text: "No, because house numbers, street signs, and school logos reveal your real-world location to strangers.", isCorrect: true },
      { text: "Yes, as long as you add cool filters.", isCorrect: false, unsafeReason: "Filters do not hide geographic landmarks or street names." }
    ],
    explanation: {
      whyCorrectSafe: "Background details in photos (house numbers, school names, park landmarks) can be used to locate you physically.",
      otherOptionsUnsafe: "Oversharing visual identifiers connects your virtual profile to your physical home and school.",
      realWorldExample: "Internet detectives and bad actors can pinpoint exact houses from reflection details or background signs.",
      followUpQuestion: {
        question: "What camera setting should you turn off when taking photos to share online?",
        options: ["Flash", "GPS Location Tagging / Geotagging", "Auto-focus"],
        correctIndex: 1,
        quickExplanation: "Geotags embed exact latitude and longitude coordinates into image metadata."
      }
    }
  },
  {
    id: "SP-03",
    category: "social_privacy",
    categoryLabel: "Social Media Privacy",
    difficulty: 2,
    question: "A viral quiz online asks: 'What was the name of your first elementary school, your mother's maiden name, and your favorite pet?' Why should you avoid this?",
    options: [
      { text: "These questions match the most common security questions used to reset bank and email passwords.", isCorrect: true },
      { text: "The quiz takes too many megabytes of phone storage.", isCorrect: false, unsafeReason: "Quizzes are web forms and do not consume phone storage." },
      { text: "It is illegal to mention pets on the internet.", isCorrect: false, unsafeReason: "Sharing pet stories is not illegal; collecting security answers is deceptive." }
    ],
    explanation: {
      whyCorrectSafe: "Scammers disguise security answer harvesting as fun viral questionnaires and friendship challenges.",
      otherOptionsUnsafe: "Answering gives attackers the keys to bypass account recovery systems on major platforms.",
      realWorldExample: "Social engineering quizzes collected millions of answers that attackers later used to break into online accounts.",
      followUpQuestion: {
        question: "What is a smart strategy when choosing answers to security questions?",
        options: ["Give true facts everyone knows.", "Use memorable nonsense answers or treat them like secondary passwords.", "Leave them blank."],
        correctIndex: 1,
        quickExplanation: "Answering 'Mother's maiden name: PurpleRocket#42' prevents anyone from guessing it."
      }
    }
  },
  {
    id: "SP-04",
    category: "social_privacy",
    categoryLabel: "Social Media Privacy",
    difficulty: 2,
    question: "Your family is going on a 7-day vacation to the beach tomorrow. When is the safest time to post vacation photos?",
    options: [
      { text: "Right now with a countdown: 'Leaving our house empty for a week!'", isCorrect: false, unsafeReason: "Broadcasting that your home is unoccupied invites burglaries." },
      { text: "Live-streaming every hour with precise GPS check-ins.", isCorrect: false, unsafeReason: "Live tracking reveals exactly where you are and when you are away from home." },
      { text: "After you return home safely from the trip.", isCorrect: true }
    ],
    explanation: {
      whyCorrectSafe: "Posting vacation memories after you return protects your home while you are away.",
      otherOptionsUnsafe: "Real-time vacation updates signal to thieves that your residence is currently vacant.",
      realWorldExample: "Insurance claims for home burglaries have been denied when homeowners publicly advertised their absence on social media.",
      followUpQuestion: {
        question: "Why should you ask friends before posting photos that feature them?",
        options: ["It is polite and respects their digital privacy and family rules.", "You need to charge them a photography fee.", "It boosts your algorithm ranking."],
        correctIndex: 0,
        quickExplanation: "Always ask permission before sharing photos of other people."
      }
    }
  },
  {
    id: "SP-05",
    category: "social_privacy",
    categoryLabel: "Social Media Privacy",
    difficulty: 3,
    question: "A popular social app requests permissions to access: 'Contacts, Microphone, Background Location, and Local Network Devices'. What should you do?",
    options: [
      { text: "Grant all permissions immediately so the app installs quickly.", isCorrect: false, unsafeReason: "Apps frequently over-request permissions to harvest telemetry for advertising or data brokers." },
      { text: "Review permissions critically and only grant what is strictly needed (e.g. deny location and contacts if not essential).", isCorrect: true },
      { text: "Delete your operating system.", isCorrect: false, unsafeReason: "Deleting your OS is destructive and nonsensical." }
    ],
    explanation: {
      whyCorrectSafe: "The principle of least privilege dictates granting only necessary hardware access.",
      otherOptionsUnsafe: "Granting background location permits constant tracking of your physical movements throughout the day.",
      realWorldExample: "Privacy audits revealed flashlight and simple calculator apps secretly uploading children's contact lists to overseas servers.",
      followUpQuestion: {
        question: "Where can you audit which apps currently have access to your microphone or camera?",
        options: ["In your device's Settings > Privacy menu.", "By turning the device upside down.", "In your browser history."],
        correctIndex: 0,
        quickExplanation: "Periodically review app permission toggles in your device settings."
      }
    }
  },

  // ==========================================
  // 4. CYBERBULLYING & KINDNESS (5 Questions)
  // ==========================================
  {
    id: "CB-01",
    category: "cyberbullying",
    categoryLabel: "Cyberbullying & Kindness",
    difficulty: 1,
    question: "Someone in your class group chat posts an embarrassing edited photo of another student and everyone starts laughing. What is the right response?",
    options: [
      { text: "Laugh along and add a meaner comment so you fit in.", isCorrect: false, unsafeReason: "Participating makes you an active cyberbully and hurts the victim deeply." },
      { text: "Do not join in; support the classmate privately and inform a teacher or trusted parent.", isCorrect: true },
      { text: "Download the photo and send it to other school group chats.", isCorrect: false, unsafeReason: "Spreading targeted harassment creates severe school disciplinary and legal consequences." }
    ],
    explanation: {
      whyCorrectSafe: "Standing up for others and alerting adults stops harassment cycles and supports vulnerable peers.",
      otherOptionsUnsafe: "Peer pressure often tempts bystanders to join in, escalating harm and distress.",
      realWorldExample: "Kindness and reporting malicious chats often saves classmates from severe anxiety and depression.",
      followUpQuestion: {
        question: "What is the difference between an 'upstander' and a 'bystander'?",
        options: ["An upstander takes safe action to help; a bystander watches without doing anything.", "An upstander sits down during class.", "They are the exact same thing."],
        correctIndex: 0,
        quickExplanation: "Upstanders use their voice to create safer communities."
      }
    }
  },
  {
    id: "CB-02",
    category: "cyberbullying",
    categoryLabel: "Cyberbullying & Kindness",
    difficulty: 1,
    question: "A player in an online multiplayer match starts spamming insults and offensive threats at you in the voice chat. What should you do first?",
    options: [
      { text: "Mute the player, block them, and use the in-game report feature.", isCorrect: true },
      { text: "Scream back insults and challenge them to a fight in real life.", isCorrect: false, unsafeReason: "Retaliating escalates aggression and can get your own gaming account banned." },
      { text: "Give them your home address to prove you aren't scared.", isCorrect: false, unsafeReason: "Never reveal physical locations to hostile online players." }
    ],
    explanation: {
      whyCorrectSafe: "Muting and reporting cuts off the troll's audience and triggers moderation reviews.",
      otherOptionsUnsafe: "Arguing gives bullies the angry reaction they want, fueling further harassment.",
      realWorldExample: "Gaming platforms automatically ban toxic accounts when players submit quick voice/chat reports.",
      followUpQuestion: {
        question: "Should you feel ashamed or keep quiet if someone bullies you online?",
        options: ["Yes, hide it completely.", "No! Bullying is never your fault; talk to a parent or counselor.", "Only tell strangers on Reddit."],
        correctIndex: 1,
        quickExplanation: "Reaching out to caring adults gives you support and solutions."
      }
    }
  },
  {
    id: "CB-03",
    category: "cyberbullying",
    categoryLabel: "Cyberbullying & Kindness",
    difficulty: 2,
    question: "If you are experiencing persistent online harassment, why is taking screenshots of the messages important before blocking the bully?",
    options: [
      { text: "To post them on your own feed to publicly shame the person.", isCorrect: false, unsafeReason: "Public shaming often backfires and creates more conflict." },
      { text: "To preserve timestamped evidence for school administrators, parents, or law enforcement.", isCorrect: true },
      { text: "To create digital trading cards to sell at school.", isCorrect: false, unsafeReason: "Evidence is for safety resolution, not novelty trading." }
    ],
    explanation: {
      whyCorrectSafe: "Bullies often delete messages later; screenshots provide undeniable evidence of dates, usernames, and threats.",
      otherOptionsUnsafe: "Without documentation, it becomes difficult for school officials or authorities to take disciplinary action.",
      realWorldExample: "Screenshots showing time, handle, and message context allow school counselors to enforce anti-bullying policies swiftly.",
      followUpQuestion: {
        question: "What information should a good evidence screenshot include?",
        options: ["Only the text words.", "The sender handle, timestamp, date, and full message context.", "Just a picture of your phone."],
        correctIndex: 1,
        quickExplanation: "Timestamps and usernames prove authenticity."
      }
    }
  },
  {
    id: "CB-04",
    category: "cyberbullying",
    categoryLabel: "Cyberbullying & Kindness",
    difficulty: 2,
    question: "What is 'Doxxing' and why is it considered a dangerous form of cyberbullying?",
    options: [
      { text: "Searching for and publishing a person's private real-world information (address, phone, school) with malicious intent.", isCorrect: true },
      { text: "Sending funny animated cartoon GIFs in a family chat.", isCorrect: false, unsafeReason: "GIFs are harmless visual memes, not doxxing." },
      { text: "Beating someone in a video game tournament.", isCorrect: false, unsafeReason: "Winning a match is standard gameplay, not a privacy violation." }
    ],
    explanation: {
      whyCorrectSafe: "Doxxing weaponizes private information to intimidate, stalk, or send harassment to a victim's physical doorstep.",
      otherOptionsUnsafe: "Doxxing is illegal in many jurisdictions and can cause real physical danger to victims and their families.",
      realWorldExample: "Online gaming feuds have resulted in swatting and harassment at innocent families' homes due to doxxing.",
      followUpQuestion: {
        question: "How can you protect yourself from being doxxed?",
        options: ["Never use your real name, school, city, or birth year as your gamer tag or public handle.", "Post your address so people don't have to search for it.", "Never play video games."],
        correctIndex: 0,
        quickExplanation: "Pseudonyms and privacy hygiene keep personal information shielded."
      }
    }
  },
  {
    id: "CB-05",
    category: "cyberbullying",
    categoryLabel: "Cyberbullying & Kindness",
    difficulty: 3,
    question: "You notice an anonymous social media confession page targeting students at your middle school with fabricated rumors. What is the most effective approach?",
    options: [
      { text: "Follow the page to read the gossip every day.", isCorrect: false, unsafeReason: "Following and engaging boosts the page's algorithmic reach." },
      { text: "Report the page directly to the hosting platform for targeted harassment and inform school administrators.", isCorrect: true },
      { text: "Create your own anonymous counter-page and post rumors about the creators.", isCorrect: false, unsafeReason: "Retaliation perpetuates a toxic cycle and exposes you to school disciplinary action." }
    ],
    explanation: {
      whyCorrectSafe: "Reporting the community page removes the megaphone, while school staff can coordinate with school resource officers.",
      otherOptionsUnsafe: "Engaging, liking, or commenting on gossip pages amplifies the spread of defamatory content.",
      realWorldExample: "Platforms like Instagram and TikTok shut down anonymous confession pages quickly once school officials submit reports.",
      followUpQuestion: {
        question: "Does anonymity protect cyberbullies from being caught by police or school officials?",
        options: ["Yes, anonymous accounts are 100% untraceable.", "No, platforms log IP addresses, device IDs, and phone numbers that can identify the creator.", "Only if they use a VPN."],
        correctIndex: 1,
        quickExplanation: "There is no true anonymity online when digital logs are subpoenaed."
      }
    }
  },

  // ==========================================
  // 5. ONLINE GAMING SCAMS (6 Questions)
  // ==========================================
  {
    id: "GS-01",
    category: "gaming_scams",
    categoryLabel: "Online Gaming Scams",
    difficulty: 1,
    question: "A website promises 'FREE ROBUX & V-BUCKS GENERATOR: No Survey, No Password, Just Enter Username & Click Run'. Does this tool really work?",
    options: [
      { text: "Yes, hackers found a secret loophole in the game servers.", isCorrect: false, unsafeReason: "Game currency is stored on authoritative company databases; free generators are 100% fake." },
      { text: "No, 'free currency generators' are complete scams designed to infect devices or steal accounts.", isCorrect: true },
      { text: "Only on weekends when game administrators are asleep.", isCorrect: false, unsafeReason: "Automated database security runs 24/7." }
    ],
    explanation: {
      whyCorrectSafe: "In-game currency can only be earned through official gameplay or purchased through verified app stores.",
      otherOptionsUnsafe: "Generator sites trick kids into installing adware or entering passwords, stealing their real accounts.",
      realWorldExample: "Over 500,000 scam domains claiming to generate free V-Bucks have been seized by cybersecurity firms.",
      followUpQuestion: {
        question: "What is the only safe way to obtain official game currency?",
        options: ["Third-party generator websites", "Through the official game app with parent permission", "From random Discord links"],
        correctIndex: 1,
        quickExplanation: "Always use authorized in-app stores."
      }
    }
  },
  {
    id: "GS-02",
    category: "gaming_scams",
    categoryLabel: "Online Gaming Scams",
    difficulty: 1,
    question: "Another player says: 'Let me borrow your rare dragon pet for 5 minutes so I can take a screenshot, then I will return it with bonus gems!' What will happen?",
    options: [
      { text: "They will keep your rare pet and immediately unfriend/block you (Trust Trade Scam).", isCorrect: true },
      { text: "They will return it with double the gems as promised.", isCorrect: false, unsafeReason: "Trust trade promises are the oldest scam in online multiplayer games." },
      { text: "The game server will automatically duplicate the pet for both of you.", isCorrect: false, unsafeReason: "Game servers do not duplicate items from unverified trade requests." }
    ],
    explanation: {
      whyCorrectSafe: "Trust trading relies on false promises; once you trade an item, the other player has full ownership and zero obligation to return it.",
      otherOptionsUnsafe: "Never trade items without using the official, simultaneous two-way trading window.",
      realWorldExample: "Games like Adopt Me and Roblox have warnings explicitly stating: 'Never do trust trades or fail trades.'",
      followUpQuestion: {
        question: "If a trade seems 'too good to be true' in an online game, what is it usually?",
        options: ["A once-in-a-lifetime opportunity", "A scam", "A developer testing you"],
        correctIndex: 1,
        quickExplanation: "If it sounds too good to be true, it is almost certainly a scam."
      }
    }
  },
  {
    id: "GS-03",
    category: "gaming_scams",
    categoryLabel: "Online Gaming Scams",
    difficulty: 2,
    question: "You want to install a game mod for Minecraft. Where is the safest place to download it?",
    options: [
      { text: "A random YouTube video description linking to 'freemods.mediafire.com'.", isCorrect: false, unsafeReason: "YouTube description links are notorious for hosting malware and trojans." },
      { text: "Official, community-vetted mod repositories like CurseForge or Modrinth with millions of verified downloads.", isCorrect: true },
      { text: "A pop-up ad that says: 'Your computer is missing Minecraft HD Mod - Click Install'.", isCorrect: false, unsafeReason: "Pop-up ads install scareware and adware." }
    ],
    explanation: {
      whyCorrectSafe: "Reputable platforms scan all uploaded mod JAR files with automated antivirus tools before releasing them.",
      otherOptionsUnsafe: "Unvetted links often bundle RATs (Remote Access Trojans) that steal cookies and passwords.",
      realWorldExample: "In 2023, the 'Fractureiser' malware infected dozens of unauthorized mod downloads across unofficial forums.",
      followUpQuestion: {
        question: "What should you always do before installing any game modification?",
        options: ["Ask a parent or tech-savvy guardian to review it.", "Turn off your antivirus so it installs faster.", "Tell all your friends to install it blindly."],
        correctIndex: 0,
        quickExplanation: "Consult trusted adults before adding external software."
      }
    }
  },
  {
    id: "GS-04",
    category: "gaming_scams",
    categoryLabel: "Online Gaming Scams",
    difficulty: 2,
    question: "A stranger in an online lobby says: 'Hey, I am a game moderator! Give me your password so I can check your account for cheating, or I will ban you in 1 hour!' How do you know this is fake?",
    options: [
      { text: "Real company moderators already have administrative tools and will NEVER ask players for their passwords.", isCorrect: true },
      { text: "Moderators only work on Tuesdays.", isCorrect: false, unsafeReason: "Moderation schedules have nothing to do with credential security." },
      { text: "You can tell because their username doesn't have diamond emojis.", isCorrect: false, unsafeReason: "Emojis do not indicate official staff status." }
    ],
    explanation: {
      whyCorrectSafe: "Legitimate support staff and engineers have backend database access; they never need your password.",
      otherOptionsUnsafe: "Panicking over fake ban threats leads players into voluntarily handing over credentials.",
      realWorldExample: "Companies like Epic Games, Valve, and Mojang explicitly display: 'Staff will NEVER ask for your password.'",
      followUpQuestion: {
        question: "What should you do when someone impersonates game staff?",
        options: ["Report them for staff impersonation and block them immediately.", "Argue with them.", "Send a fake password."],
        correctIndex: 0,
        quickExplanation: "Staff impersonation violates every game platform's rules."
      }
    }
  },
  {
    id: "GS-05",
    category: "gaming_scams",
    categoryLabel: "Online Gaming Scams",
    difficulty: 3,
    question: "You find an online community trading game accounts. A seller offers a maxed-out account with $1,000 worth of rare skins for only $20. Why is buying accounts a huge mistake?",
    options: [
      { text: "Account buying violates game Terms of Service, risks permanent bans, and original owners can recover the account anytime.", isCorrect: true },
      { text: "It is only a mistake if you pay with coins instead of bills.", isCorrect: false, unsafeReason: "The payment method does not alter the fundamental fraud and ban risk." },
      { text: "Game accounts automatically stop working after 30 days.", isCorrect: false, unsafeReason: "Accounts do not expire naturally; they get banned for unauthorized transfers." }
    ],
    explanation: {
      whyCorrectSafe: "Game publishers actively ban bought/sold accounts, and sellers routinely recover sold accounts via original billing records.",
      otherOptionsUnsafe: "You lose your money and the account when the original creator reports it 'hacked' to reclaim it.",
      realWorldExample: "Nearly 85% of purchased secondary game accounts are either reclaimed by the scammer or permanently banned by anti-cheat systems.",
      followUpQuestion: {
        question: "Who truly owns an in-game account according to platform agreements?",
        options: ["The platform publisher, who licenses access to the original creator.", "Whoever buys it on eBay.", "Nobody."],
        correctIndex: 0,
        quickExplanation: "Game licenses are non-transferable."
      }
    }
  },
  {
    id: "GS-06",
    category: "gaming_scams",
    categoryLabel: "Online Gaming Scams",
    difficulty: 3,
    question: "A friend's Steam or Discord account messages you: 'Hey, my competitive team needs one more vote to win a $500 tournament. Click this link and sign in through Steam to vote for us!' What is happening?",
    options: [
      { text: "Your friend's account was compromised and is being used by a bot to spread API phishing links.", isCorrect: true },
      { text: "Your friend is going to become a professional eSports gamer.", isCorrect: false, unsafeReason: "Tournament voting scams are widespread automated phishing lures." },
      { text: "A harmless voting contest run by Valve.", isCorrect: false, unsafeReason: "The fake login page clones the Steam OpenID interface to steal login tokens." }
    ],
    explanation: {
      whyCorrectSafe: "The 'Vote for my team' scam uses hijacked friend accounts to appear trustworthy, linking to fake OpenID popups.",
      otherOptionsUnsafe: "Entering credentials into these fake login portals transfers your inventory and account to the bot network.",
      realWorldExample: "Contact your friend through a different channel (text message or phone call) to alert them their account was hijacked.",
      followUpQuestion: {
        question: "What is the best way to verify if an unusual request from a friend is real?",
        options: ["Message them on the same hacked chat.", "Call them or talk to them in person at school.", "Trust it automatically."],
        correctIndex: 1,
        quickExplanation: "Out-of-band communication confirms the sender's true identity."
      }
    }
  },

  // ==========================================
  // 6. AI SAFETY AND DEEPFAKES (6 Questions)
  // ==========================================
  {
    id: "AI-01",
    category: "ai_deepfakes",
    categoryLabel: "AI Safety & Deepfakes",
    difficulty: 1,
    question: "What is an 'AI Deepfake'?",
    options: [
      { text: "A computer hardware chip that overheats when gaming.", isCorrect: false, unsafeReason: "Deepfakes are software media creations, not physical computer chips." },
      { text: "Realistic video, audio, or images created using artificial intelligence to make someone look or sound like they said or did something they never did.", isCorrect: true },
      { text: "An automated robot that vacuums carpets.", isCorrect: false, unsafeReason: "That is a household vacuum cleaner, not artificial media." }
    ],
    explanation: {
      whyCorrectSafe: "Deepfakes use neural networks to clone voices and synthesize faces onto bodies with uncanny realism.",
      otherOptionsUnsafe: "Believing all audio and video online is authentic leaves you vulnerable to misinformation and fraud.",
      realWorldExample: "Deepfake videos of celebrities promoting fake gift cards are widely circulated on social video platforms.",
      followUpQuestion: {
        question: "Can someone's voice be cloned with just a short 10-second audio clip today?",
        options: ["No, it takes 10 years of recording.", "Yes, modern generative AI audio models can clone voices rapidly.", "Only on supercomputers in space."],
        correctIndex: 1,
        quickExplanation: "Voice cloning technology requires very little source audio to synthesize speech."
      }
    }
  },
  {
    id: "AI-02",
    category: "ai_deepfakes",
    categoryLabel: "AI Safety & Deepfakes",
    difficulty: 1,
    question: "You see a video online of your favorite celebrity claiming that a certain website is giving away $1,000 to every teenager who signs up. How should you treat this?",
    options: [
      { text: "Be skeptical; check verified news sources because this is likely an AI-generated deepfake scam.", isCorrect: true },
      { text: "Believe it immediately because video never lies.", isCorrect: false, unsafeReason: "Video and audio can be completely generated by AI models now." },
      { text: "Give the website your credit card details right away.", isCorrect: false, unsafeReason: "Never enter financial information on unverified promotional websites." }
    ],
    explanation: {
      whyCorrectSafe: "Critical thinking is essential. Scammers generate deepfakes of trusted figures to endorse scams.",
      otherOptionsUnsafe: "Assuming that visual video evidence is automatically truthful leads to financial and identity theft.",
      realWorldExample: "Deepfakes of YouTubers like MrBeast have been generated by scammers to advertise fake giveaways on YouTube ads.",
      followUpQuestion: {
        question: "What visual clues can sometimes give away an AI-generated video?",
        options: ["Unnatural blinking, blurry teeth, weird hand fingers, or audio not matching lips.", "The video is always black and white.", "The video has a siren sound."],
        correctIndex: 0,
        quickExplanation: "Look for subtle visual glitches around hands, ears, and lip synchronization."
      }
    }
  },
  {
    id: "AI-03",
    category: "ai_deepfakes",
    categoryLabel: "AI Safety & Deepfakes",
    difficulty: 2,
    question: "You are chatting with a popular AI chatbot for homework assistance. What information should you NEVER type into the chat prompt?",
    options: [
      { text: "Questions about photosynthesis or ancient Egyptian history.", isCorrect: false, unsafeReason: "Educational and historical inquiries are safe and recommended." },
      { text: "Your full name, home address, school, passwords, or personal family secrets.", isCorrect: true },
      { text: "Drafts of your creative fictional adventure story.", isCorrect: false, unsafeReason: "Creative writing assistance is a safe use case for AI." }
    ],
    explanation: {
      whyCorrectSafe: "Chat prompts may be reviewed by human trainers or used to train future public foundation models.",
      otherOptionsUnsafe: "Pasting private credentials or home addresses risks exposing your private data in training data leaks.",
      realWorldExample: "Major tech companies have banned employees from pasting proprietary software code into public chatbots.",
      followUpQuestion: {
        question: "Can public AI chatbots guarantee that what you type remains 100% confidential?",
        options: ["Yes, always.", "No, most privacy policies state data may be retained for training and review.", "Only on Saturdays."],
        correctIndex: 1,
        quickExplanation: "Review the platform's data retention policies before using AI tools."
      }
    }
  },
  {
    id: "AI-04",
    category: "ai_deepfakes",
    categoryLabel: "AI Safety & Deepfakes",
    difficulty: 2,
    question: "An AI chatbot confidently gives you a detailed history answer for your school report. Can you trust that every fact is 100% accurate?",
    options: [
      { text: "Yes, artificial intelligence is omniscient and never makes mistakes.", isCorrect: false, unsafeReason: "AI models frequently generate 'hallucinations' — believable falsehoods." },
      { text: "No, AI models can 'hallucinate' and invent convincing false information; you must always cross-check with credible sources.", isCorrect: true },
      { text: "AI only lies if you don't say 'please'.", isCorrect: false, unsafeReason: "Politeness does not affect factual model training weights." }
    ],
    explanation: {
      whyCorrectSafe: "Generative AI predicts likely text tokens rather than verifying facts; cross-referencing with textbooks or encyclopedias is required.",
      otherOptionsUnsafe: "Submitting unverified AI text can result in failing grades for fabricated citations and historical inaccuracies.",
      realWorldExample: "Lawyers have faced court sanctions for citing fictitious legal cases generated by AI chatbots.",
      followUpQuestion: {
        question: "What is the best way to verify a fact provided by an AI chatbot?",
        options: ["Search credible library databases, textbooks, or official educational websites.", "Ask the same chatbot again: 'Are you sure?'", "Assume it is true."],
        correctIndex: 0,
        quickExplanation: "Verify AI claims through authoritative primary sources."
      }
    }
  },
  {
    id: "AI-05",
    category: "ai_deepfakes",
    categoryLabel: "AI Safety & Deepfakes",
    difficulty: 3,
    question: "A classmate uses an AI image generator to place your face onto an inappropriate photo and threatens to share it if you don't give them money. What is this crime?",
    options: [
      { text: "AI Extortion / Sextortion, which is a serious felony offense.", isCorrect: true },
      { text: "A harmless school prank that you should ignore.", isCorrect: false, unsafeReason: "Non-consensual deepfake creation is a criminal act, not a joke." },
      { text: "A creative digital art exercise protected by copyright.", isCorrect: false, unsafeReason: "Fabricating abusive imagery of minors is explicitly illegal." }
    ],
    explanation: {
      whyCorrectSafe: "Generating non-consensual deepfakes of minors and demanding money is cyber-extortion, punishable by law.",
      otherOptionsUnsafe: "Paying money never stops extortionists; they will only demand more. Always tell trusted adults immediately.",
      realWorldExample: "Law enforcement and organizations like NCMEC actively prosecute individuals who generate synthetic abusive imagery.",
      followUpQuestion: {
        question: "What should you do immediately if someone threatens you with an AI-generated image?",
        options: ["Pay them the money.", "Save evidence, do not pay, and immediately tell your parents, school, or police.", "Delete your phone."],
        correctIndex: 1,
        quickExplanation: "Adults and law enforcement can intervene to protect you and remove the media."
      }
    }
  },
  {
    id: "AI-06",
    category: "ai_deepfakes",
    categoryLabel: "AI Safety & Deepfakes",
    difficulty: 3,
    question: "Your grandmother receives a phone call with what sounds exactly like your voice crying and saying: 'Grandma, I'm in trouble in another city, please wire $2,000 right now!' What is this scam?",
    options: [
      { text: "An AI Voice Clone Emergency Scam targeting seniors.", isCorrect: true },
      { text: "A phone connection error where signals got crossed.", isCorrect: false, unsafeReason: "Phone networks do not accidentally synthesize emergency distress calls." },
      { text: "A routine banking verification procedure.", isCorrect: false, unsafeReason: "Banks never ask customers to wire emergency funds to unknown third parties." }
    ],
    explanation: {
      whyCorrectSafe: "Scammers use AI voice synthesis tools to clone voices from short social media videos to panic grandparents into wiring money.",
      otherOptionsUnsafe: "Panicking causes victims to send money before checking if their grandchild is actually safe at home.",
      realWorldExample: "Establish a 'Family Secret Safe Word' that only real family members know to verify genuine emergencies.",
      followUpQuestion: {
        question: "What is an effective defense against AI voice clone kidnapping/emergency scams?",
        options: ["Hang up and call the real family member directly on their known phone number, or ask for the family safe word.", "Wire the money immediately just in case.", "Change your voice."],
        correctIndex: 0,
        quickExplanation: "Calling the known number or asking for the family safe word stops the scam instantly."
      }
    }
  },

  // ==========================================
  // 7. PERSONAL INFORMATION PROTECTION (6 Questions)
  // ==========================================
  {
    id: "PI-01",
    category: "personal_info",
    categoryLabel: "Personal Info Protection",
    difficulty: 1,
    question: "Which of the following is considered Personally Identifiable Information (PII) that should NEVER be shared with strangers online?",
    options: [
      { text: "Your favorite color and favorite ice cream flavor.", isCorrect: false, unsafeReason: "Favorite colors are generic and do not reveal your identity." },
      { text: "Your full real name, home address, phone number, and school name.", isCorrect: true },
      { text: "Your favorite video game genre.", isCorrect: false, unsafeReason: "Liking racing or RPG games is safe general conversation." }
    ],
    explanation: {
      whyCorrectSafe: "PII can identify, contact, or locate a specific individual in the physical world.",
      otherOptionsUnsafe: "Giving out your full name and address allows strangers to find your house, school, or contact your family.",
      realWorldExample: "Keep your online gamer tag distinct from your legal first and last name.",
      followUpQuestion: {
        question: "Is it safe to share what city or neighborhood you live in on public game servers?",
        options: ["No, keep location details general and private.", "Yes, as long as you don't give the zip code.", "Yes, to find local friends."],
        correctIndex: 0,
        quickExplanation: "Location details should always remain guarded."
      }
    }
  },
  {
    id: "PI-02",
    category: "personal_info",
    categoryLabel: "Personal Info Protection",
    difficulty: 1,
    question: "You want to create a fun username for a new online game. Which username choice is the safest?",
    options: [
      { text: "Leo_Smith_AustinTexas_2013", isCorrect: false, unsafeReason: "Reveals your real name, birth year, and city of residence." },
      { text: "CyberFalcon_88", isCorrect: true },
      { text: "Emily_OakridgeElementary_Age9", isCorrect: false, unsafeReason: "Reveals your first name, school name, and exact age." }
    ],
    explanation: {
      whyCorrectSafe: "Great usernames are creative and have zero connection to your real name, birthday, or school.",
      otherOptionsUnsafe: "Combining names, ages, and cities in handles gives strangers a profile before they even speak to you.",
      realWorldExample: "Using 'CyberFalcon_88' tells other players you like cool avatars without revealing anything personal.",
      followUpQuestion: {
        question: "Should your password be the same as your username?",
        options: ["No, that makes it the easiest password in the world to guess.", "Yes, for convenience.", "Only on your phone."],
        correctIndex: 0,
        quickExplanation: "Never make passwords match usernames."
      }
    }
  },
  {
    id: "PI-03",
    category: "personal_info",
    categoryLabel: "Personal Info Protection",
    difficulty: 2,
    question: "You are filling out a sign-up form for an online drawing contest. The form asks for your Social Security Number (or national ID) and parent's credit card. What should you do?",
    options: [
      { text: "Stop immediately! Drawing contests have no legitimate reason to ask for government ID numbers or credit cards.", isCorrect: true },
      { text: "Enter random numbers to trick the form.", isCorrect: false, unsafeReason: "Interacting with predatory forms may still log IP telemetry or trigger malicious downloads." },
      { text: "Ask your parents for their card so you can enter quickly.", isCorrect: false, unsafeReason: "Legitimate student contests never ask for financial credentials." }
    ],
    explanation: {
      whyCorrectSafe: "Government identification numbers and credit card numbers are high-value targets for identity theft.",
      otherOptionsUnsafe: "Fake contests use appealing prizes to trick children into harvesting their parents' financial data.",
      realWorldExample: "Identity theft can damage a child's credit score before they even turn 18 years old.",
      followUpQuestion: {
        question: "What is identity theft?",
        options: ["When someone borrows your jacket.", "When someone illegally uses your personal information to open accounts or take loans in your name.", "When you forget your own name."],
        correctIndex: 1,
        quickExplanation: "Protecting PII prevents catastrophic identity fraud."
      }
    }
  },
  {
    id: "PI-04",
    category: "personal_info",
    categoryLabel: "Personal Info Protection",
    difficulty: 2,
    question: "You are setting up a wearable fitness smartwatch. The companion mobile app asks for permission to 'Share live health and location metrics with advertising partners'. What choice should you select?",
    options: [
      { text: "Select 'Disagree' / 'Opt-out' of sharing health and location data with advertisers.", isCorrect: true },
      { text: "Select 'Agree to all' because advertisers need to know your heart rate.", isCorrect: false, unsafeReason: "Advertisers do not need your biometric or health data." },
      { text: "Turn off the watch forever.", isCorrect: false, unsafeReason: "You can enjoy the device safely simply by configuring privacy toggles correctly." }
    ],
    explanation: {
      whyCorrectSafe: "Opting out prevents data brokers from building advertising profiles around your daily physical habits.",
      otherOptionsUnsafe: "Agreeing allows third-party data brokers to sell your movement patterns to marketing networks.",
      realWorldExample: "Privacy regulations like COPPA in the US and GDPR-K in Europe give children the legal right to opt out of data tracking.",
      followUpQuestion: {
        question: "What is a 'Data Broker'?",
        options: ["A company that buys, aggregates, and sells personal information about individuals.", "A computer repair technician.", "A bank teller."],
        correctIndex: 0,
        quickExplanation: "Data brokers profit from buying and selling personal internet footprints."
      }
    }
  },
  {
    id: "PI-05",
    category: "personal_info",
    categoryLabel: "Personal Info Protection",
    difficulty: 3,
    question: "You are selling an old tablet online with your parents. Before handing the tablet to the buyer, what is the critical security step?",
    options: [
      { text: "Wipe down the screen with a microfiber cloth.", isCorrect: false, unsafeReason: "Cleaning the physical screen leaves all your private accounts, photos, and passwords intact." },
      { text: "Sign out of all cloud accounts, perform a complete cryptographic Factory Reset, and remove any microSD cards.", isCorrect: true },
      { text: "Delete your favorite wallpaper photo.", isCorrect: false, unsafeReason: "Deleting one photo leaves emails, browser cookies, and saved passwords accessible." }
    ],
    explanation: {
      whyCorrectSafe: "A full factory reset overwrites encryption keys and wipes all stored app tokens, photos, and browser credentials.",
      otherOptionsUnsafe: "Simply deleting files into the trash allows buyers using free recovery software to resurrect your photos and documents.",
      realWorldExample: "Thousands of discarded phones and tablets sold second-hand still contain previous owners' sensitive emails and banking logins.",
      followUpQuestion: {
        question: "What should you remove from a phone or camera before selling or recycling it?",
        options: ["The battery cover only.", "Any SIM cards and external MicroSD memory cards.", "The volume buttons."],
        correctIndex: 1,
        quickExplanation: "Memory and SIM cards hold contacts and photo archives."
      }
    }
  },
  {
    id: "PI-06",
    category: "personal_info",
    categoryLabel: "Personal Info Protection",
    difficulty: 3,
    question: "What is 'Metadata' embedded inside a digital photograph taken on a smartphone?",
    options: [
      { text: "Hidden information including exact GPS coordinates, date, time, camera model, and device settings (EXIF data).", isCorrect: true },
      { text: "The artistic quality score assigned by photography judges.", isCorrect: false, unsafeReason: "Metadata is technical data, not an artistic score." },
      { text: "The color filter applied to the photo.", isCorrect: false, unsafeReason: "Filters alter pixels; metadata records device and location telemetry." }
    ],
    explanation: {
      whyCorrectSafe: "EXIF metadata often contains precise GPS location coordinates where the photo was snapped.",
      otherOptionsUnsafe: "Posting raw unstripped photos online can allow strangers to extract your exact bedroom coordinates.",
      realWorldExample: "Modern messaging platforms strip EXIF data automatically, but posting to personal websites or open forums often preserves it.",
      followUpQuestion: {
        question: "How can you prevent cameras from saving GPS coordinates in photos?",
        options: ["Turn off Location Services for the Camera app in device privacy settings.", "Take photos with your eyes closed.", "Only take photos at night."],
        correctIndex: 0,
        quickExplanation: "Disabling camera location stops geotagging at the source."
      }
    }
  },

  // ==========================================
  // 8. DIGITAL FOOTPRINT (5 Questions)
  // ==========================================
  {
    id: "DF-01",
    category: "digital_footprint",
    categoryLabel: "Digital Footprint",
    difficulty: 1,
    question: "What is your 'Digital Footprint'?",
    options: [
      { text: "The physical size of your shoes when playing dancing games.", isCorrect: false, unsafeReason: "Shoe sizes are physical, not digital." },
      { text: "The permanent trail of information, photos, comments, and search history left behind whenever you use the internet.", isCorrect: true },
      { text: "A battery-saving mode on laptops.", isCorrect: false, unsafeReason: "Digital footprint is a privacy concept, not a battery state." }
    ],
    explanation: {
      whyCorrectSafe: "Every post, like, comment, and search contributes to your cumulative digital reputation.",
      otherOptionsUnsafe: "Assuming online actions vanish when you log out leads to thoughtless posts that can haunt your future.",
      realWorldExample: "College admissions counselors and future employers regularly check applicants' public online history.",
      followUpQuestion: {
        question: "Can content you post online be saved by someone else even if you delete it 10 seconds later?",
        options: ["No, deleting removes it from the entire universe.", "Yes, anyone can take a screenshot or web archives can index it.", "Only if they have a special government computer."],
        correctIndex: 1,
        quickExplanation: "Screenshots capture content permanently in seconds."
      }
    }
  },
  {
    id: "DF-02",
    category: "digital_footprint",
    categoryLabel: "Digital Footprint",
    difficulty: 1,
    question: "You are angry at a referee after losing a weekend soccer match. Is it a good idea to post a furious video calling the referee names online?",
    options: [
      { text: "Yes, because you have freedom of speech to vent whenever you want.", isCorrect: false, unsafeReason: "Online rants can get you suspended from sports leagues and damage your reputation." },
      { text: "No; pause, cool down, and talk to your parents or coach. Never post online in anger.", isCorrect: true },
      { text: "Only if you delete it after 1 hour.", isCorrect: false, unsafeReason: "An hour is plenty of time for coaches and leagues to record evidence." }
    ],
    explanation: {
      whyCorrectSafe: "Practicing the 'Grandma Rule' (Would you want your grandmother or future boss to see this?) avoids permanent regrets.",
      otherOptionsUnsafe: "Impulsive posts during moments of frustration can result in team dismissals and school penalties.",
      realWorldExample: "High school athletes have had college sports scholarships revoked due to angry social media rants.",
      followUpQuestion: {
        question: "What is the recommended rule of thumb before posting anything emotional online?",
        options: ["Post immediately while your emotions are intense.", "Wait 24 hours and ask yourself if it reflects the person you want to be.", "Have someone else post it for you."],
        correctIndex: 1,
        quickExplanation: "A 24-hour buffer gives clarity and prevents impulsive posts."
      }
    }
  },
  {
    id: "DF-03",
    category: "digital_footprint",
    categoryLabel: "Digital Footprint",
    difficulty: 2,
    question: "What does 'Private Browsing' / 'Incognito Mode' actually do?",
    options: [
      { text: "It prevents your local device from saving browsing history, search cookies, and temporary files on that specific browser.", isCorrect: true },
      { text: "It makes you completely invisible to websites, your internet provider, and school network administrators.", isCorrect: false, unsafeReason: "Incognito does NOT hide traffic from Wi-Fi routers or ISPs." },
      { text: "It stops computer viruses from ever infecting your laptop.", isCorrect: false, unsafeReason: "Incognito provides zero malware protection." }
    ],
    explanation: {
      whyCorrectSafe: "Incognito mode only wipes local history on that specific machine; network administrators and websites can still see your IP traffic.",
      otherOptionsUnsafe: "Believing incognito mode grants total anonymity leads people to engage in risky or prohibited browsing on school networks.",
      realWorldExample: "School Wi-Fi filters monitor and log all website requests regardless of whether a student opened a private window.",
      followUpQuestion: {
        question: "Can your school network see websites you visit on their Wi-Fi while in Incognito Mode?",
        options: ["Yes, router logs record all domain requests.", "No, Incognito makes you a ghost.", "Only if you are on a Mac."],
        correctIndex: 0,
        quickExplanation: "Network gateways log domain requests at the router level."
      }
    }
  },
  {
    id: "DF-04",
    category: "digital_footprint",
    categoryLabel: "Digital Footprint",
    difficulty: 2,
    question: "You want to build a positive, inspiring digital footprint that will help you in high school and college. What should you do?",
    options: [
      { text: "Never touch the internet ever again.", isCorrect: false, unsafeReason: "Total avoidance is unnecessary; responsible usage opens great opportunities." },
      { text: "Share your creative coding projects, artwork, volunteer work, and positive school achievements.", isCorrect: true },
      { text: "Argue with random people in comment sections to show off your debate skills.", isCorrect: false, unsafeReason: "Internet arguments look immature and reflect poorly on your digital character." }
    ],
    explanation: {
      whyCorrectSafe: "A positive digital footprint showcases your talents, leadership, and curiosity to future scholarship committees.",
      otherOptionsUnsafe: "Engaging in flamewars creates negative search engine results associated with your name.",
      realWorldExample: "Students who build portfolios on GitHub or share science projects often win prestigious university scholarships.",
      followUpQuestion: {
        question: "What should you do if you Google your own name and find an old embarrassing comment from 3 years ago?",
        options: ["Log into that old account and delete or edit the comment to keep your profile clean.", "Panic and change your legal name.", "Ignore it and hope nobody notices."],
        correctIndex: 0,
        quickExplanation: "Periodic digital footprint cleanups keep your record polished."
      }
    }
  },
  {
    id: "DF-05",
    category: "digital_footprint",
    categoryLabel: "Digital Footprint",
    difficulty: 3,
    question: "What is the 'Right to be Forgotten' in modern global cybersecurity privacy laws?",
    options: [
      { text: "The legal right for citizens to request that search engines and websites delete outdated or inaccurate personal data about them.", isCorrect: true },
      { text: "A computer hardware feature that deletes your RAM memory when powered off.", isCorrect: false, unsafeReason: "That is volatile RAM behavior, not a legal privacy principle." },
      { text: "A rule that forbids teachers from remembering test scores.", isCorrect: false, unsafeReason: "Academic record keeping is completely unrelated." }
    ],
    explanation: {
      whyCorrectSafe: "Laws like GDPR give people the right to petition search engines to delist obsolete personal data that damages their reputation.",
      otherOptionsUnsafe: "Assuming everything online is permanent without knowing your legal privacy rights prevents you from exercising data control.",
      realWorldExample: "In Europe and California, individuals can submit formal requests to Google to remove outdated juvenile records from search results.",
      followUpQuestion: {
        question: "Can websites refuse to delete content if it is considered essential news or legal history?",
        options: ["Yes, privacy laws balance personal privacy with public interest and press freedom.", "No, everyone can delete any news story anytime.", "Only in Antarctica."],
        correctIndex: 0,
        quickExplanation: "Public interest and historical records are legally protected."
      }
    }
  },

  // ==========================================
  // 9. SAFE DOWNLOADS AND MALWARE (6 Questions)
  // ==========================================
  {
    id: "SD-01",
    category: "safe_downloads",
    categoryLabel: "Safe Downloads & Malware",
    difficulty: 1,
    question: "You click a movie streaming site and a giant red flashing window screams: 'VIRUS DETECTED! YOUR PHONE IS INFECTED WITH 17 TROJANS! CALL 1-800-HELP-NOW OR CLICK HERE TO CLEAN!' What is this?",
    options: [
      { text: "A real emergency warning from your phone's operating system.", isCorrect: false, unsafeReason: "Web browsers cannot scan your device files; websites can never detect device viruses." },
      { text: "A fake 'Scareware' pop-up designed to panic you into installing actual malware or calling a scam call center.", isCorrect: true },
      { text: "Your battery overheating.", isCorrect: false, unsafeReason: "Battery warnings are native OS dialogs, not colorful browser banners." }
    ],
    explanation: {
      whyCorrectSafe: "Websites inside a browser sandbox cannot inspect your operating system files; any site claiming '17 viruses found' is lying.",
      otherOptionsUnsafe: "Clicking 'Clean Now' downloads the exact malware the popup pretends to protect against.",
      realWorldExample: "Close the browser tab immediately. Never call phone numbers displayed on flashing web banners.",
      followUpQuestion: {
        question: "How should you safely exit a scareware pop-up that won't let you click away?",
        options: ["Close the entire browser tab or force-close the browser app.", "Click the big green button.", "Pay them money."],
        correctIndex: 0,
        quickExplanation: "Force-closing the tab terminates the malicious web script safely."
      }
    }
  },
  {
    id: "SD-02",
    category: "safe_downloads",
    categoryLabel: "Safe Downloads & Malware",
    difficulty: 1,
    question: "A website button says: 'DOWNLOAD MINECRAFT FREE FULL VERSION CRACKED .ZIP'. What is the most likely danger?",
    options: [
      { text: "Pirated and cracked software downloads are the #1 delivery mechanism for trojans, spyware, and crypto-miners.", isCorrect: true },
      { text: "It will make your keyboard type in Spanish.", isCorrect: false, unsafeReason: "Malware aims to harvest credentials or encrypt files, not alter keyboard languages." },
      { text: "There is no danger; free software is always safe.", isCorrect: false, unsafeReason: "Cracked software bundles hidden malicious payloads." }
    ],
    explanation: {
      whyCorrectSafe: "Hackers provide 'free' paid games specifically to bundle background malware that runs silently while you play.",
      otherOptionsUnsafe: "Cracked executables ask for administrator permissions, giving attackers root access to your entire computer.",
      realWorldExample: "Over 60% of pirated software downloads from torrents or shady file lockers contain hidden backdoors or crypto-mining scripts.",
      followUpQuestion: {
        question: "What is a 'Trojan Horse' in computer security?",
        options: ["Malware disguised as something useful or fun (like a game or mod) that secretly harms your system.", "A wooden horse statue.", "A fast Wi-Fi router."],
        correctIndex: 0,
        quickExplanation: "Like the ancient myth, Trojans deceive users to gain entry."
      }
    }
  },
  {
    id: "SD-03",
    category: "safe_downloads",
    categoryLabel: "Safe Downloads & Malware",
    difficulty: 2,
    question: "What is 'Ransomware' and how does it affect computers?",
    options: [
      { text: "Malware that encrypts all your photos, documents, and games, locking you out until you pay an extortion fee.", isCorrect: true },
      { text: "A program that makes your computer screen brighter.", isCorrect: false, unsafeReason: "Screen brightness is a display setting, not ransomware." },
      { text: "An antivirus tool developed by the FBI.", isCorrect: false, unsafeReason: "Ransomware is malicious extortion software, not an antivirus tool." }
    ],
    explanation: {
      whyCorrectSafe: "Ransomware holds user data hostage using military-grade encryption algorithms.",
      otherOptionsUnsafe: "Falling for suspicious downloads can lock your family's personal photo archives permanently.",
      realWorldExample: "Hospitals and school districts have had computer networks crippled for weeks by ransomware attacks.",
      followUpQuestion: {
        question: "What is the best defense to recover from a ransomware attack without paying extortionists?",
        options: ["Regular, automated offline backups of important files onto external drives or secure cloud storage.", "Pleading with the hackers.", "Restarting the computer 100 times."],
        correctIndex: 0,
        quickExplanation: "Offline backups restore your files without paying ransoms."
      }
    }
  },
  {
    id: "SD-04",
    category: "safe_downloads",
    categoryLabel: "Safe Downloads & Malware",
    difficulty: 2,
    question: "You want to download an app on an Android tablet. Which option is significantly safer?",
    options: [
      { text: "Downloading random .APK installation files from forums with 'Install from Unknown Sources' enabled.", isCorrect: false, unsafeReason: "Sideloading unverified APKs bypasses Google Play Protect screening." },
      { text: "Downloading exclusively from the official Google Play Store or verified device manufacturer store.", isCorrect: true },
      { text: "Downloading from a link sent by a stranger in a chat room.", isCorrect: false, unsafeReason: "Strangers frequently share malware payloads." }
    ],
    explanation: {
      whyCorrectSafe: "Official app stores maintain automated vulnerability scanners and security reviews to weed out malware.",
      otherOptionsUnsafe: "Enabling 'Unknown Sources' allows arbitrary unvetted APK packages to execute with device permissions.",
      realWorldExample: "Google Play Protect scans over 125 billion apps every single day to detect trojans.",
      followUpQuestion: {
        question: "Even on official app stores, what should you inspect before installing a new app?",
        options: ["User reviews, developer reputation, number of downloads, and requested permissions.", "Only the icon color.", "Nothing, all apps are identical."],
        correctIndex: 0,
        quickExplanation: "Always review ratings and requested permissions."
      }
    }
  },
  {
    id: "SD-05",
    category: "safe_downloads",
    categoryLabel: "Safe Downloads & Malware",
    difficulty: 3,
    question: "Why is keeping your device's Operating System (Windows, macOS, iOS, Android) updated so crucial for cybersecurity?",
    options: [
      { text: "System updates include vital security patches that close discovered vulnerabilities before hackers can exploit them.", isCorrect: true },
      { text: "Updates are only meant to change the color of icons.", isCorrect: false, unsafeReason: "Updates fix critical low-level kernel and security flaws." },
      { text: "Updates delete your homework automatically.", isCorrect: false, unsafeReason: "Updates protect and preserve data, not delete homework." }
    ],
    explanation: {
      whyCorrectSafe: "When security researchers or hackers discover flaws (zero-days), manufacturers release urgent security patches to seal the holes.",
      otherOptionsUnsafe: "Postponing updates leaves known vulnerabilities open on your device, allowing automated exploit kits to breach your system.",
      realWorldExample: "The global WannaCry ransomware outbreak primarily infected machines that had failed to install a Microsoft security patch released two months earlier.",
      followUpQuestion: {
        question: "What is an effective setting to ensure your phone or laptop stays protected against newly discovered threats?",
        options: ["Enable Automatic Updates so patches install overnight while charging.", "Never restart your computer.", "Turn off Wi-Fi permanently."],
        correctIndex: 0,
        quickExplanation: "Automatic updates keep defenses up-to-date seamlessly."
      }
    }
  },
  {
    id: "SD-06",
    category: "safe_downloads",
    categoryLabel: "Safe Downloads & Malware",
    difficulty: 3,
    question: "What is a 'Keylogger' and how does it secretly compromise your security?",
    options: [
      { text: "Malware that records every single keystroke you type (including passwords and credit cards) and transmits the logs to an attacker.", isCorrect: true },
      { text: "A mechanical keyboard cleaning tool.", isCorrect: false, unsafeReason: "That is a cleaning brush, not software malware." },
      { text: "A software shortcut that unlocks door locks in video games.", isCorrect: false, unsafeReason: "That is a game cheat code, not a security term." }
    ],
    explanation: {
      whyCorrectSafe: "Keyloggers operate silently in background processes, intercepting keystrokes before they are starred out on screen.",
      otherOptionsUnsafe: "Even if you enter complex passwords, a keylogger captures the exact character sequence as you type.",
      realWorldExample: "Cybersecurity tools like password managers and on-screen virtual keyboards help bypass traditional keyloggers.",
      followUpQuestion: {
        question: "How do keyloggers commonly infect devices?",
        options: ["Through malicious email attachments, cracked software, or malicious game cheats.", "By looking at a computer screen.", "By typing too fast."],
        correctIndex: 0,
        quickExplanation: "Never install unverified cheat software or suspicious attachments."
      }
    }
  },

  // ==========================================
  // 10. ONLINE STRANGER SAFETY (5 Questions)
  // ==========================================
  {
    id: "SS-01",
    category: "stranger_safety",
    categoryLabel: "Online Stranger Safety",
    difficulty: 1,
    question: "An online gaming acquaintance you've played with for two weeks says: 'You're my best friend! Let's meet at the city park this Saturday after school. Don't tell your parents, it's our secret!' What should you do?",
    options: [
      { text: "Go to the park alone so you don't embarrass them.", isCorrect: false, unsafeReason: "Never meet an online stranger in the real world alone. This is an extreme safety risk." },
      { text: "Immediately tell your parents or a trusted adult; anyone asking you to keep secrets from your family is a dangerous red flag.", isCorrect: true },
      { text: "Invite other strangers from the game to come with you.", isCorrect: false, unsafeReason: "Involving more minors does not eliminate the physical danger." }
    ],
    explanation: {
      whyCorrectSafe: "Anyone online who asks a child to keep secrets from their parents is engaging in predatory grooming behavior.",
      otherOptionsUnsafe: "Online personas can be completely fabricated; an adult can easily pretend to be a 12-year-old gamer.",
      realWorldExample: "Trusted adults will NEVER ask children to keep secret meetings or hide conversations from their guardians.",
      followUpQuestion: {
        question: "Can an online predator use stolen photos and kid slang to pretend to be someone your age?",
        options: ["Yes, easily. Online identities cannot be verified without trusted adult supervision.", "No, computer filters prevent lying.", "Only in movies."],
        correctIndex: 0,
        quickExplanation: "Never assume online strangers are who they claim to be."
      }
    }
  },
  {
    id: "SS-02",
    category: "stranger_safety",
    categoryLabel: "Online Stranger Safety",
    difficulty: 1,
    question: "A stranger in a chat room sends you a message asking for your picture, saying: 'Show me what you look like! Send a selfie right now!' How should you respond?",
    options: [
      { text: "Take a selfie and send it so they think you are friendly.", isCorrect: false, unsafeReason: "Never send photos of yourself to strangers online." },
      { text: "Refuse, block the user, and inform your parents or guardians.", isCorrect: true },
      { text: "Send a picture of your school building instead.", isCorrect: false, unsafeReason: "Sending your school photo reveals your physical location." }
    ],
    explanation: {
      whyCorrectSafe: "Setting firm boundaries and blocking demanding strangers prevents harassment and unwanted contact.",
      otherOptionsUnsafe: "Sharing personal photos gives strangers leverage to request more photos or track your identity.",
      realWorldExample: "Trust your gut: if any message or request online makes you feel uncomfortable, tell an adult immediately.",
      followUpQuestion: {
        question: "If an online contact threatens to share secrets if you don't send pictures, what should you do?",
        options: ["Give in to their demands.", "Tell your parents immediately; you are not in trouble, and adults will protect you.", "Delete your computer."],
        correctIndex: 1,
        quickExplanation: "You are never at fault when someone tries to manipulate or threaten you."
      }
    }
  },
  {
    id: "SS-03",
    category: "stranger_safety",
    categoryLabel: "Online Stranger Safety",
    difficulty: 2,
    question: "What is 'Online Grooming' and what are the warning signs?",
    options: [
      { text: "When an online contact gradually builds trust through flattery, gift-giving (like free game currency), and asking for secrets before making inappropriate requests.", isCorrect: true },
      { text: "When someone brushes their hair while streaming on Twitch.", isCorrect: false, unsafeReason: "Physical hair brushing is completely unrelated to psychological grooming." },
      { text: "A setting that cleans temporary files from your web browser.", isCorrect: false, unsafeReason: "That is cache cleaning, not child safety grooming." }
    ],
    explanation: {
      whyCorrectSafe: "Understanding the grooming pattern (compliments -> gifts -> isolating you from parents -> inappropriate requests) empowers kids to spot danger early.",
      otherOptionsUnsafe: "Predators rarely reveal malicious intentions immediately; they invest weeks in pretending to be caring friends.",
      realWorldExample: "A stranger offering to buy you rare game skins in exchange for private Discord calls is exhibiting classic grooming tactics.",
      followUpQuestion: {
        question: "What should you do if an online friend asks you to move the conversation to an encrypted app where messages disappear?",
        options: ["Agree immediately.", "Recognize this as a tactic to hide conversations from your parents, refuse, and alert your guardians.", "Share the link with everyone."],
        correctIndex: 1,
        quickExplanation: "Disappearing messaging apps are often used to evade parental oversight."
      }
    }
  },
  {
    id: "SS-04",
    category: "stranger_safety",
    categoryLabel: "Online Stranger Safety",
    difficulty: 2,
    question: "You are live streaming a video game. A viewer in the chat says: 'Show us what your bedroom looks like! Turn the camera around!' What should you do?",
    options: [
      { text: "Keep the camera focused on gameplay, decline the request, and have your stream moderator block any viewers demanding personal room tours.", isCorrect: true },
      { text: "Give a full tour of your house including the front door and street view.", isCorrect: false, unsafeReason: "House tours broadcast your physical floor plan and valuables to thousands of strangers." },
      { text: "Show your family's calendar on the wall.", isCorrect: false, unsafeReason: "Family calendars reveal work hours, vacations, and daily schedules." }
    ],
    explanation: {
      whyCorrectSafe: "Maintaining camera boundaries keeps your private sanctuary protected from viewer exploitation.",
      otherOptionsUnsafe: "Room tours often inadvertently broadcast diplomas with full names, family photos, and window views that identify neighborhoods.",
      realWorldExample: "Professional streamers use green screens or blurred backgrounds specifically to prevent location leaks.",
      followUpQuestion: {
        question: "What should you check in your background before turning on a webcam for school or gaming?",
        options: ["Check that no family photos, school awards, addresses, or windows revealing street signs are visible.", "Check that you have 5 bags of chips.", "Nothing matters."],
        correctIndex: 0,
        quickExplanation: "Sanitize your physical background before streaming."
      }
    }
  },
  {
    id: "SS-05",
    category: "stranger_safety",
    categoryLabel: "Online Stranger Safety",
    difficulty: 3,
    question: "You receive an unsolicited direct message from an account claiming to be a modeling talent scout or professional eSports scout, offering you a contract if you send private photos or join an unmonitored private video room. How do you assess this?",
    options: [
      { text: "It is an elaborate predator deception; legitimate agencies do not scout minors via unsolicited social media direct messages.", isCorrect: true },
      { text: "You are about to become a famous supermodel or pro gamer overnight.", isCorrect: false, unsafeReason: "Scouts never approach minors secretly in direct messages without parent involvement." },
      { text: "Send the photos immediately so you don't miss the talent deadline.", isCorrect: false, unsafeReason: "Sending private photos to online accounts is dangerous and can lead to extortion." }
    ],
    explanation: {
      whyCorrectSafe: "Professional modeling and gaming organizations adhere to strict youth protection laws and work exclusively through parents and licensed agents.",
      otherOptionsUnsafe: "Predators use glamorous promises of fame and fortune to coerce minors into compromising situations.",
      realWorldExample: "Organizations like the FBI Cyber Division and Interpol routinely issue warnings regarding fake talent scout schemes targeting teens.",
      followUpQuestion: {
        question: "If a real talent agency ever did want to contact a minor, who must they contact first by law?",
        options: ["Your parents or legal guardians directly with official verification.", "Your best friend.", "Random people in your comments."],
        correctIndex: 0,
        quickExplanation: "Legitimate professional opportunities always involve parents or legal guardians."
      }
    }
  }
];

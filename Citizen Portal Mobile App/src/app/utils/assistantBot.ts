

export interface IntentPattern {
  intentName: string;
  keywords: string[];
  response: string;
}

export const INTENTS: IntentPattern[] = [
  {
    intentName: 'greeting',
    keywords: [
      'hello', 'hi', 'hey', 'sawubona', 'molweni', 'dumela', 'dumelang', 'khotso',
      'môre', 'goeie dag', 'greetings', 'good morning', 'good afternoon', 'unjani',
    ],
    response:
      "Sawubona! 👋 I'm the MzansiReport help assistant. I can help with reports, report status, live service availability, and emergency contacts. How can I help?",
  },
  {
    intentName: 'report_issue',
    keywords: [
      'report', 'submit', 'new report', 'log issue', 'complain', 'lodge', 'pothole',
      'leak', 'outage', 'spill', 'pipe', 'dumping', 'broken',
    ],
    response:
      "To submit a municipal report:\n1. Tap 'New Report'.\n2. Choose a category and describe the issue.\n3. Add the location and municipality.\n4. Submit. The report appears in operations after the database confirms it.",
  },
  {
    intentName: 'emergency',
    keywords: [
      'emergency', 'sos', 'police', 'fire', 'ambulance', 'medical', 'panic', 'danger',
      'hazard', '10111', '10177', '112', 'crime',
    ],
    response:
      '🚨 EMERGENCY CONTACTS:\n• SAPS Police: 10111\n• Fire & Ambulance: 10177\n• National Emergency: 112 (Cellular)\n• Crime Stop: 08600 10111\nYou can also tap the red Emergency SOS button on any screen for direct dialing!',
  },
  {
    intentName: 'loadshedding',
    keywords: [
      'loadshedding', 'load shedding', 'power', 'electricity', 'stage', 'eskom', 'outage',
      'blackout', 'substation', 'cable theft', 'tripped',
    ],
    response:
      "Load-shedding status is shown when the live provider is available. For a local power issue, submit a report under 'Electricity'.",
  },
  {
    intentName: 'water_sanitation',
    keywords: [
      'water', 'leak', 'burst', 'pipe', 'sewage', 'sewer', 'no water', 'cut off',
      'meter', 'drain', 'flood', 'flooding', 'dirty water',
    ],
    response:
      "Report burst pipes, sewage leaks, or water outages using 'New Report'. Check the saved report details for its current status and due date.",
  },
  {
    intentName: 'track_report',
    keywords: [
      'track', 'status', 'progress', 'reference', 'my reports', 'update', 'ticket',
      'ref', 'sla', 'timeline',
    ],
    response:
      "📊 Track Report Progress:\nGo to 'My Reports' on your dashboard. Tap any report to view its status (Submitted ➔ In Progress ➔ Resolved), assigned municipality unit, and live SLA countdown timer.",
  },
  {
    intentName: 'municipality_directory',
    keywords: [
      'municipality', 'contact', 'phone', 'call', 'office', 'joburg', 'tshwane',
      'ethekwini', 'cape town', 'ekurhuleni', 'mangaung', 'nelson mandela',
    ],
    response:
      'For municipality office contacts, use the official website or contact centre for your municipality. Choose your municipality from the report form when submitting an issue.',
  },
  {
    intentName: 'hero_points',
    keywords: [
      'points', 'hero', 'badge', 'level', 'reward', 'gamification', 'rank', 'bronze',
      'silver', 'gold', 'platinum', 'diamond',
    ],
    response:
      '🏆 Community Hero Points:\n• Earn +10 Hero Points for every report submitted.\n• Earn +2 Hero Points for every \'Me Too\' upvote given.\n• Level Up: Bronze (0 pts) ➔ Silver (50 pts) ➔ Gold (150 pts) ➔ Platinum (300 pts) ➔ Diamond (500+ pts)!',
  },
  {
    intentName: 'community_feed',
    keywords: [
      'community', 'feed', 'upvote', 'me too', 'neighbours', 'nearby', 'trending',
    ],
    response:
      "👥 Community Feed & Upvoting:\nView issues reported in your neighborhood. Tap 'Me Too' on reports affecting your area to boost their community weight and help staff prioritize high-impact repairs!",
  },
  {
    intentName: 'billing_rates',
    keywords: [
      'bill', 'billing', 'rates', 'taxes', 'account', 'statement', 'payment', 'tariff',
      'meter reading',
    ],
    response:
      "For billing, rates, or account questions, contact your municipality's official revenue department or website.",
  },
  {
    intentName: 'sassa_home_affairs',
    keywords: [
      'sassa', 'home affairs', 'id', 'passport', 'grant', 'srd', 'cert', 'certificate',
      'birth',
    ],
    response:
      '🇿🇦 National Government Services:\n• SASSA Grant Enquiries: 0800 60 10 11\n• Home Affairs Helpline: 0800 60 11 90\nCheck the Services tab in the app for step-by-step guides and online application portals!',
  },
  {
    intentName: 'thanks',
    keywords: [
      'thank', 'thanks', 'dankie', 'ngiyabonga', 'ke a leboha', 'bye', 'goodbye',
    ],
    response:
      "You're welcome! 🇿🇦 Together we're building cleaner, safer, and better South African communities. Feel free to ask me anything about MzansiReport anytime!",
  },
];

export const DEFAULT_RESPONSE =
  "I use built-in keyword matching to route common questions. You can ask me about:\n" +
  '• Submitting or tracking a report\n' +
  '• Emergency numbers & SOS\n' +
  '• Load shedding & water status\n' +
  '• Municipality contact directory\n' +
  '• Community Hero points & feed\n' +
  '• SASSA & Home Affairs services';


export function getBotResponse(input: string): string {
  if (!input || !input.trim()) return DEFAULT_RESPONSE;

  const lower = input.toLowerCase();
  let bestPattern: IntentPattern | null = null;
  let maxScore = 0;

  for (const pattern of INTENTS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword)) {
        score += keyword.length > 5 ? 2 : 1;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestPattern = pattern;
    }
  }

  if (bestPattern && maxScore > 0) {
    return bestPattern.response;
  }

  return DEFAULT_RESPONSE;
}
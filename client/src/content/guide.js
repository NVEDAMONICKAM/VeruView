/**
 * guide.js — Culture-aware guide content for the VeruView info drawer.
 * Keys: ENGLISH | TAMIL
 */

export const GUIDE_CONTENT = {
  ENGLISH: {
    drawerTitle: 'How to use VeruView',
    sections: [
      {
        heading: 'Getting Started',
        body: [
          {
            type: 'para',
            text: 'VeruView lets you build a family tree that shows the correct cultural titles for each family member, depending on whose perspective you\'re viewing from.',
          },
          {
            type: 'subheading',
            text: 'Adding your first person',
          },
          {
            type: 'list',
            items: [
              'Click "Add Person" (sidebar) to create your first family member — usually yourself or the root of your family.',
              'Fill in their name, date of birth (optional but recommended for sibling ordering), gender, and photo.',
            ],
          },
        ],
      },
      {
        heading: 'Building Your Tree',
        body: [
          {
            type: 'subheading',
            text: 'Two ways to add people',
          },
          {
            type: 'numbered',
            items: [
              {
                label: 'Using the + buttons on a tile',
                detail: 'Right (+) → adds a spouse/partner linked to this person. Bottom (+) → adds a child of this person. These automatically create the correct relationship — no extra steps needed.',
              },
              {
                label: 'Free-floating and connect',
                detail: 'Use "Add Person" to create an unconnected person, then drag from the anchor dots on a tile\'s edge to another tile and choose the relationship from the popup.',
              },
            ],
          },
          {
            type: 'subheading',
            text: 'Linking a child to both parents',
          },
          {
            type: 'list',
            items: [
              'If a child already exists and you want to link them to a second parent, drag from the second parent\'s bottom anchor to the child\'s top anchor and select "Parent → Child" then "Biological".',
              'You do NOT need to re-create the child — just draw a second parent edge.',
              'A child can have at most two biological parents in the tree.',
            ],
          },
          {
            type: 'subheading',
            text: 'Step-parents',
          },
          {
            type: 'list',
            items: [
              'When connecting a parent edge, you will be asked: Biological or Step-parent?',
              'Step-parents get a different title (Step-father / Step-mother).',
              'You can change this later by clicking the relationship line.',
            ],
          },
        ],
      },
      {
        heading: 'Perspectives',
        body: [
          {
            type: 'list',
            items: [
              'Click any person\'s tile to switch to their perspective.',
              'All titles in the tree update to show what that person would call everyone else.',
              'The selected perspective tile has a yellow border.',
              'The current perspective is shown in the top bar: "Viewing as: [Name]"',
            ],
          },
        ],
      },
      {
        heading: 'Layout',
        body: [
          {
            type: 'list',
            items: [
              'Drag any tile to reposition it freely — positions are saved automatically.',
              'Click "Auto-organise" in the toolbar to snap everyone into a neat layout.',
              'Use pinch-to-zoom or the scroll wheel to zoom in/out.',
            ],
          },
        ],
      },
      {
        heading: 'Culture Toggle',
        body: [
          {
            type: 'list',
            items: [
              'Use the English / Tamil toggle in the top bar to switch title language.',
              'In Tamil mode, titles appear in Tamil script with transliteration below.',
              'In English mode, only English titles are shown.',
            ],
          },
        ],
      },
      {
        heading: 'Known Limitations',
        body: [
          {
            type: 'list',
            items: [
              'Polygamous relationships are not currently supported (one spouse per person).',
              'Very distant relationships (e.g. second cousins) may show as உறவினர் — this is intentional and culturally accurate.',
              'More cultures and languages are coming soon.',
            ],
          },
        ],
      },
    ],
    lastUpdated: 'April 2026',
  },

  TAMIL: {
    drawerTitle: 'VeruView பயன்படுத்துவது எப்படி',
    sections: [
      {
        heading: 'தொடங்குவது எப்படி',
        body: [
          {
            type: 'para',
            text: 'VeruView மூலம் உங்கள் குடும்ப மரத்தை உருவாக்கலாம். யாரின் பார்வையில் பார்க்கிறோம் என்பதை பொறுத்து சரியான தமிழ் உறவுமுறை பெயர்கள் தானாகவே காட்டப்படும்.',
          },
          {
            type: 'subheading',
            text: 'முதல் நபரை சேர்ப்பது எப்படி (How to add your first person)',
          },
          {
            type: 'list',
            items: [
              '"Add Person" பொத்தானை கிளிக் செய்து முதல் நபரை உருவாக்கவும் — பொதுவாக நீங்களே அல்லது குடும்பத்தின் மூலம்.',
              'பெயர், பிறந்த தேதி (DOB — அண்ணன்/தம்பி வரிசைக்கு முக்கியம்), பாலினம், புகைப்படம் கொடுக்கலாம்.',
            ],
          },
        ],
      },
      {
        heading: 'முக்கியமான தமிழ் உறவுமுறை விளக்கங்கள்',
        body: [
          {
            type: 'para',
            text: 'கீழே உள்ள அட்டவணையில் VeruView பயன்படுத்தும் அனைத்து தமிழ் உறவுமுறை பெயர்களும் உள்ளன:',
          },
          {
            type: 'table',
            columns: ['உறவு (Relationship)', 'பெயர் (Title)'],
            rows: [
              ['தந்தை (Father)', 'அப்பா'],
              ['தாய் (Mother)', 'அம்மா'],
              ['மூத்த அண்ணன் (Older brother)', 'அண்ணன்'],
              ['இளைய தம்பி (Younger brother)', 'தம்பி'],
              ['மூத்த அக்கா (Older sister)', 'அக்கா'],
              ['இளைய தங்கை (Younger sister)', 'தங்கை'],
              ['தந்தையின் அப்பா (Paternal grandfather)', 'தாத்தா'],
              ['தந்தையின் அம்மா (Paternal grandmother)', 'பாட்டி'],
              ['தாயின் அப்பா (Maternal grandfather)', 'தாத்தா'],
              ['தாயின் அம்மா (Maternal grandmother)', 'பாட்டி'],
              ["தந்தையின் மூத்த அண்ணன் (Father's older brother)", 'பெரியப்பா'],
              ["தந்தையின் இளைய தம்பி (Father's younger brother)", 'சித்தப்பா'],
              ["தந்தையின் அக்கா/தங்கை (Father's sister)", 'அத்தை'],
              ["தாயின் அண்ணன்/தம்பி (Mother's brother)", 'மாமா'],
              ["தாயின் மூத்த அக்கா (Mother's older sister)", 'பெரியம்மா'],
              ["தாயின் இளைய தங்கை (Mother's younger sister)", 'சித்தி'],
              ["மாமாவின் மனைவி (Mother's brother's wife)", 'மாமி'],
              ["சித்தப்பாவின் மனைவி (Father's younger brother's wife)", 'சித்தி'],
              ["பெரியப்பாவின் மனைவி (Father's older brother's wife)", 'பெரியம்மா'],
              ["அத்தையின் கணவன் (Father's sister's husband)", 'மாமா'],
              ['கணவன் (Husband)', 'கணவன்'],
              ['மனைவி (Wife)', 'மனைவி'],
              ['மகன் (Son)', 'மகன்'],
              ['மகள் (Daughter)', 'மகள்'],
              ['மருமகன் (Son-in-law / Nephew)', 'மருமகன்'],
              ['மருமகள் (Daughter-in-law / Niece)', 'மருமகள்'],
              ['பேரன் (Grandson)', 'பேரன்'],
              ['பேத்தி (Granddaughter)', 'பேத்தி'],
              ['மாமனார் (Father-in-law)', 'மாமனார்'],
              ['மாமியார் (Mother-in-law)', 'மாமியார்'],
              ['மைத்துனன் (Brother-in-law)', 'மைத்துனன்'],
              ['நாத்தனார் (Sister-in-law)', 'நாத்தனார்'],
              ['சம்பந்தி (Co-parent-in-law)', 'சம்பந்தி'],
            ],
          },
        ],
      },
      {
        heading: 'தெரிந்து கொள்ள வேண்டியவை (Important Notes)',
        body: [
          {
            type: 'note',
            title: 'அண்ணன் vs தம்பி / அக்கா vs தங்கை',
            text: 'தமிழில் உறவுமுறை பெயர்கள் வயதை பொறுத்து மாறும். பிறந்த தேதி (Date of Birth) கொடுத்தால் சரியான பெயர் தானாக வரும். DOB இல்லாமல் இருந்தால், அண்ணன் / அக்கா என்று காட்டப்படும். Sibling titles depend on relative age — add dates of birth for accurate older/younger titles.',
          },
          {
            type: 'note',
            title: 'உறவினர் என்றால் என்ன',
            text: 'சில தூர உறவினர்களுக்கு (உதாரணம்: cousin) தமிழில் தனி பெயர் இல்லை. அவர்களுக்கு "உறவினர்" என்று காட்டப்படும் — இது சரியான தமிழ் வழக்கே. Tamil has no single word for "cousin". உறவினர் (Relative) is the correct and culturally accurate term.',
          },
          {
            type: 'note',
            title: 'சம்பந்தி',
            text: 'உங்கள் மகன் அல்லது மகளின் மாமனார்/மாமியார் — இவர்களை சம்பந்தி என்று அழைப்பது தமிழ் கலாச்சார வழக்கம்.',
          },
          {
            type: 'note',
            title: 'மாற்றானப்பன் / மாற்றாந்தாய் (Step-parent)',
            text: 'யாரையாவது step-parent ஆக குறிக்க, இணைப்பு கோடை கிளிக் செய்து "Step-parent" என்று தேர்ந்தெடுக்கவும்.',
          },
          {
            type: 'note',
            title: 'பாட்டி vs அம்மாச்சி',
            text: 'பாட்டி என்பது standard Tamil வார்த்தை. ஆனால் சில குடும்பங்களில் (குறிப்பாக Sri Lankan Tamil) அம்மாச்சி என்று சொல்வார்கள். Tree Settings sidebar-ல் உங்கள் குடும்பத்திற்கு சரியான வார்த்தையை தேர்ந்தெடுக்கலாம். The word for grandmother varies by region and family — choose between பாட்டி and அம்மாச்சி in the sidebar settings.',
          },
        ],
      },
      {
        heading: 'பார்வை மாற்றல் (Perspective)',
        body: [
          {
            type: 'list',
            items: [
              'எந்த நபரையும் கிளிக் செய்தால் அவரின் பார்வையில் உறவுகள் காட்டப்படும்.',
              'தேர்ந்தெடுக்கப்பட்ட நபரின் tile-க்கு மஞ்சள் நிற border வரும்.',
              'மேல் bar-ல் "Viewing as: [பெயர்]" என்று காட்டப்படும்.',
            ],
          },
        ],
      },
      {
        heading: 'தெரிந்த வரம்புகள் (Known Limitations)',
        body: [
          {
            type: 'list',
            items: [
              'தற்போது ஒருவருக்கு ஒரே ஒரு கணவன்/மனைவி மட்டுமே சேர்க்கலாம்.',
              'மிகவும் தூர உறவினர்களுக்கு (second cousins போன்றவர்) "உறவினர்" என்று காட்டப்படும் — இது நேர்மையான பதில்.',
              'மேலும் மொழிகள் விரைவில் வரும்.',
            ],
          },
        ],
      },
    ],
    lastUpdated: 'ஏப்ரல் 2026',
  },
};

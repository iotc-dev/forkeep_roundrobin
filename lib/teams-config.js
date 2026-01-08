// ==============================
// SHARED TEAM CONFIGURATION
// Uses HubSpot USER IDs only
// ==============================

export const TEAMS = {
  '499': {
    name: '499 and under',
    members: [
      { userId: 76316685, name: 'Mary Gantuangco', active: true },
      { userId: 76316686, name: 'Bethany Cui', active: true },

      // inactive
      { userId: 71143294, name: 'Emma Naughton', active: false },
      { userId: 82237378, name: 'Zack Edwards', active: false },
      { userId: 71143418, name: 'Niamh Hamilton', active: false },
      { userId: 82237377, name: 'Leilani Goodall', active: false },
      { userId: 71143450, name: 'Aoife Cripps', active: false }
    ]
  },

  '500': {
    name: '500 - 5999',
    members: [
      { userId: 71143294, name: 'Emma Naughton', active: true },
      { userId: 82237378, name: 'Zack Edwards', active: true },
      { userId: 71143418, name: 'Niamh Hamilton', active: true },
      { userId: 82237377, name: 'Leilani Goodall', active: true },
      { userId: 71143450, name: 'Aoife Cripps', active: true },

      // inactive
      { userId: 76316685, name: 'Mary Gantuangco', active: false },
      { userId: 76316686, name: 'Bethany Cui', active: false }
    ]
  },

  '6000': {
    name: '6000 and over',
    members: [
      { userId: 71143294, name: 'Emma Naughton', active: true },
      { userId: 71143418, name: 'Niamh Hamilton', active: true },

      // inactive
      { userId: 82237378, name: 'Zack Edwards', active: false },
      { userId: 82237377, name: 'Leilani Goodall', active: false },
      { userId: 71143450, name: 'Aoife Cripps', active: false },
      { userId: 76316685, name: 'Mary Gantuangco', active: false },
      { userId: 76316686, name: 'Bethany Cui', active: false }
    ]
  },

  'unknown': {
    name: 'Unknown Amount',
    members: [
      { userId: 71143294, name: 'Emma Naughton', active: true },
      { userId: 82237378, name: 'Zack Edwards', active: true },
      { userId: 71143418, name: 'Niamh Hamilton', active: true },
      { userId: 82237377, name: 'Leilani Goodall', active: true },
      { userId: 71143450, name: 'Aoife Cripps', active: true },

      // inactive
      { userId: 76316685, name: 'Mary Gantuangco', active: false },
      { userId: 76316686, name: 'Bethany Cui', active: false }
    ]
  }
};

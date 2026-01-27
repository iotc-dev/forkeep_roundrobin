// ==============================
// SHARED TEAM CONFIGURATION
// Used by: assign.js, teams.js, toggle-status.js
// 
// NOTE: "defaultActive" is used as fallback when Redis has no value.
// The actual active state is stored in Redis and managed via /admin
// ==============================

export const TEAMS = {
  '499': {
    name: '499 and under',
    members: [
      { id: '468741631', name: 'Rory Boyle', defaultActive: false },
      { id: '76316685', name: 'Mary Gantuangco', defaultActive: true },
      { id: '76316686', name: 'Bethany Cui', defaultActive: true },
      { id: '1286204956', name: 'Emma Naughton', defaultActive: false },
      { id: '82237378', name: 'Zack Edwards', defaultActive: false },
      { id: '672462337', name: 'Niamh Hamilton', defaultActive: false },
      { id: '82237377', name: 'Leilani Goodall', defaultActive: false },
      { id: '1217171174', name: 'Aoife Cripps', defaultActive: false }
    ]
  },

  '500': {
    name: '500 - 5999',
    members: [
      { id: '468741631', name: 'Rory Boyle', defaultActive: false },
      { id: '1286204956', name: 'Emma Naughton', defaultActive: true },
      { id: '82237378', name: 'Zack Edwards', defaultActive: true },
      { id: '672462337', name: 'Niamh Hamilton', defaultActive: true },
      { id: '82237377', name: 'Leilani Goodall', defaultActive: true },
      { id: '1217171174', name: 'Aoife Cripps', defaultActive: true },
      { id: '76316685', name: 'Mary Gantuangco', defaultActive: false },
      { id: '76316686', name: 'Bethany Cui', defaultActive: false }
    ]
  },

  '6000': {
    name: '6000 and over',
    members: [
      { id: '468741631', name: 'Rory Boyle', defaultActive: false },
      { id: '1286204956', name: 'Emma Naughton', defaultActive: true },
      { id: '672462337', name: 'Niamh Hamilton', defaultActive: true },
      { id: '82237378', name: 'Zack Edwards', defaultActive: false },
      { id: '82237377', name: 'Leilani Goodall', defaultActive: false },
      { id: '1217171174', name: 'Aoife Cripps', defaultActive: false },
      { id: '76316685', name: 'Mary Gantuangco', defaultActive: false },
      { id: '76316686', name: 'Bethany Cui', defaultActive: false }
    ]
  },

  'unknown': {
    name: 'Unknown Amount',
    members: [
      { id: '468741631', name: 'Rory Boyle', defaultActive: false },
      { id: '1286204956', name: 'Emma Naughton', defaultActive: true },
      { id: '82237378', name: 'Zack Edwards', defaultActive: true },
      { id: '672462337', name: 'Niamh Hamilton', defaultActive: true },
      { id: '82237377', name: 'Leilani Goodall', defaultActive: true },
      { id: '1217171174', name: 'Aoife Cripps', defaultActive: true },
      { id: '76316685', name: 'Mary Gantuangco', defaultActive: false },
      { id: '76316686', name: 'Bethany Cui', defaultActive: false }
    ]
  }
};
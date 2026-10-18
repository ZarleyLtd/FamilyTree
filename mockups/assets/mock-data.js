/**
 * Fictional sample family for UI mockups. No real people.
 * Five generations of the Brennan family (Dublin / Mayo / Boston).
 */
window.MOCK_DATA = (function () {
  'use strict';

  function P(id, given, surname, sex, birth, death, extra) {
    return Object.assign(
      { id: id, given: given, surname: surname, sex: sex, birth: birth || null, death: death || null },
      extra || {}
    );
  }
  function D(text, year, place) {
    return { text: text, year: year, place: place || '' };
  }

  var persons = [
    // Generation 1 – great-great-grandparents
    P('p1', 'Patrick', 'Brennan', 'M', D('abt 1858', 1858, 'Swinford, Co. Mayo'), D('14 Mar 1931', 1931, 'Phibsborough, Dublin'), { occupation: 'Railway porter', photo: true }),
    P('p2', 'Mary', 'Brennan', 'F', D('1862', 1862, 'Castlebar, Co. Mayo'), D('1940', 1940, 'Dublin'), { birthSurname: 'Walsh' }),
    P('p7', 'Thomas', 'Nolan', 'M', D('1860', 1860, 'Thomastown, Co. Kilkenny'), D('bef 1922', 1922, 'Dublin'), { occupation: 'Cooper' }),
    P('p8', 'Bridget', 'Nolan', 'F', D('abt 1865', 1865, 'Co. Kilkenny'), D('1944', 1944, 'Dublin'), { birthSurname: 'Kavanagh' }),

    // Generation 2
    P('p3', 'James', 'Brennan', 'M', D('2 Feb 1885', 1885, 'Phibsborough, Dublin'), D('1962', 1962, 'Dublin'), { occupation: 'Tram driver', photo: true }),
    P('p4', 'Margaret', 'Doyle', 'F', D('1887', 1887, 'Phibsborough, Dublin'), D('1970', 1970, 'Drumcondra, Dublin'), { birthSurname: 'Brennan' }),
    P('p5', 'Michael', 'Brennan', 'M', D('1890', 1890, 'Phibsborough, Dublin'), D('9 Aug 1917', 1917, 'Ypres, Belgium'), { occupation: 'Soldier, Royal Dublin Fusiliers', photo: true }),
    P('p6', 'Kate', 'Hughes', 'F', D('1893', 1893, 'Phibsborough, Dublin'), D('1980', 1980, 'Boston, Massachusetts'), { birthSurname: 'Brennan' }),
    P('p9', 'Annie', 'Brennan', 'F', D('Q2 1890', 1890, 'Dublin'), D('1975', 1975, 'Dublin'), { birthSurname: 'Nolan', photo: true }),
    P('p10', 'Peter', 'Nolan', 'M', D('1893', 1893, 'Dublin'), D('1960', 1960, 'Dublin')),
    P('p15', 'John', 'Doyle', 'M', D('1884', 1884, 'Drumcondra, Dublin'), D('1950', 1950, 'Dublin'), { occupation: 'Publican' }),
    P('p17', 'William', 'Hughes', 'M', D('abt 1890', 1890, 'Boston, Massachusetts'), D('1965', 1965, 'Boston, Massachusetts')),

    // Generation 3
    P('p11', 'Patrick', 'Brennan', 'M', D('4 Jun 1913', 1913, 'Phibsborough, Dublin'), D('21 Nov 1989', 1989, 'Mater Hospital, Dublin'), { nickname: 'Paddy', occupation: 'Tram conductor, later CIÉ inspector', photo: true }),
    P('p12', 'Mary', 'Brennan', 'F', D('16 Oct 1915', 1915, 'Phibsborough, Dublin'), D('1999', 1999, 'Dublin'), { nickname: 'Sr. Mary Columba', occupation: 'Religious sister' }),
    P('p13', 'Thomas', 'Brennan', 'M', D('1918', 1918, 'Phibsborough, Dublin'), D('1990', 1990, 'Dublin'), { occupation: 'Carpenter' }),
    P('p14', 'Josephine', 'Keogh', 'F', D('1922', 1922, 'Cabra, Dublin'), D('2010', 2010, 'Dublin'), { birthSurname: 'Brennan', photo: true }),
    P('p16', 'Seán', 'Doyle', 'M', D('1915', 1915, 'Drumcondra, Dublin'), D('1988', 1988, 'Dublin')),
    P('p18', 'Rose', 'Hughes', 'F', D('1920', 1920, 'Boston, Massachusetts'), D('2005', 2005, 'Boston, Massachusetts')),
    P('p19', 'Eileen', 'Brennan', 'F', D('12 Sep 1918', 1918, 'Cabra, Dublin'), D('2001', 2001, 'Dublin'), { birthSurname: 'Murphy', photo: true }),
    P('p23', 'Nora', 'Brennan', 'F', D('1920', 1920, 'Dublin'), D('1995', 1995, 'Dublin'), { birthSurname: 'Byrne' }),
    P('p25', 'Frank', 'Keogh', 'M', D('1919', 1919, 'Dublin'), D('1998', 1998, 'Dublin')),

    // Generation 4
    P('p20', 'Michael', 'Brennan', 'M', D('1943', 1943, 'Cabra, Dublin'), null, { occupation: 'Retired teacher', photo: true }),
    P('p21', 'Patricia', 'Brennan', 'F', D('1946', 1946, 'Cabra, Dublin'), null),
    P('p22', 'Gerard', 'Brennan', 'M', D('1950', 1950, 'Cabra, Dublin'), D('22 Oct 2019', 2019, 'Dublin'), { occupation: 'Bus driver' }),
    P('p24', 'Thomas', 'Brennan', 'M', D('1948', 1948, 'Dublin'), null, { suffix: 'Jr' }),
    P('p26', 'Catherine', 'Keogh', 'F', D('1952', 1952, 'Dublin'), null),
    P('p27', 'Anne', 'Brennan', 'F', D('1946', 1946, 'Galway'), null, { birthSurname: 'Fitzgerald', photo: true }),

    // Generation 5
    P('p28', 'David', 'Brennan', 'M', D('1971', 1971, 'Dublin'), null, { photo: true }),
    P('p29', 'Siobhán', 'Brennan', 'F', D('1974', 1974, 'Dublin'), null),
    P('p30', 'Conor', 'Brennan', 'M', D('1979', 1979, 'Dublin'), null),
    P('p31', 'Laura', 'Brennan', 'F', D('1973', 1973, 'Cork'), null, { birthSurname: 'Kelly' }),

    // Generation 6
    P('p32', 'Aoife', 'Brennan', 'F', D('2003', 2003, 'Dublin'), null),
    P('p33', 'Cian', 'Brennan', 'M', D('2006', 2006, 'Dublin'), null)
  ];

  function F(id, p1, p2, marriage, children, type) {
    return { id: id, p1: p1, p2: p2, type: type || 'married', marriage: marriage || null, children: children || [] };
  }

  var families = [
    F('f1', 'p1', 'p2', D('1884', 1884, 'Castlebar, Co. Mayo'), ['p3', 'p4', 'p5', 'p6']),
    F('f2', 'p7', 'p8', D('1888', 1888, 'Kilkenny'), ['p9', 'p10']),
    F('f3', 'p3', 'p9', D('26 Apr 1912', 1912, 'St Peter\u2019s, Phibsborough'), ['p11', 'p12', 'p13', 'p14']),
    F('f4', 'p15', 'p4', D('1910', 1910, 'Dublin'), ['p16']),
    F('f5', 'p17', 'p6', D('1919', 1919, 'Boston, Massachusetts'), ['p18']),
    F('f6', 'p11', 'p19', D('8 Jun 1941', 1941, 'St Peter\u2019s, Phibsborough'), ['p20', 'p21', 'p22']),
    F('f7', 'p13', 'p23', D('9 Oct 1946', 1946, 'Dublin'), ['p24']),
    F('f8', 'p25', 'p14', D('1950', 1950, 'Dublin'), ['p26']),
    F('f9', 'p20', 'p27', D('14 Jun 1969', 1969, 'Galway Cathedral'), ['p28', 'p29', 'p30']),
    F('f10', 'p28', 'p31', D('2001', 2001, 'Cork'), ['p32', 'p33'])
  ];

  /** Extra events beyond birth/marriage/death (keyed by person id). */
  var events = {
    p11: [
      { type: 'occupation', date: '1935', year: 1935, place: 'Dublin United Tramways', description: 'Conductor on the Phibsborough line' },
      { type: 'residence', date: '1945', year: 1945, place: '12 Cabra Park, Cabra, Dublin', description: 'Family home until 1989' },
      { type: 'occupation', date: '1958', year: 1958, place: 'CIÉ, Broadstone', description: 'Promoted to inspector' },
      { type: 'burial', date: '24 Nov 1989', year: 1989, place: 'Glasnevin Cemetery, Dublin', description: 'Plot KD 112' }
    ],
    p1: [
      { type: 'census', date: '31 Mar 1901', year: 1901, place: '4 Leinster Street North, Phibsborough', description: 'Head of household, railway porter, aged 43' },
      { type: 'census', date: '2 Apr 1911', year: 1911, place: '4 Leinster Street North, Phibsborough', description: 'Aged 53, married 27 years, 6 children born, 4 living' }
    ],
    p5: [
      { type: 'military', date: '1915', year: 1915, place: 'Dublin', description: 'Enlisted, 8th Bn Royal Dublin Fusiliers' }
    ],
    p6: [
      { type: 'emigration', date: 'Apr 1912', year: 1912, place: 'Queenstown (Cobh) \u2192 Boston', description: 'Sailed on the SS Cymric' }
    ],
    p20: [
      { type: 'occupation', date: '1965', year: 1965, place: 'St Vincent\u2019s CBS, Glasnevin', description: 'Teacher, later principal' }
    ]
  };

  /** Media with placeholder art (no real photos). hue drives the placeholder gradient. */
  var media = [
    { id: 'm1', kind: 'portrait', title: 'Paddy Brennan in CIÉ uniform', date: 'abt 1958', year: 1958, place: 'Broadstone, Dublin', people: ['p11'], hue: 210, primaryFor: 'p11' },
    { id: 'm2', kind: 'photo', title: 'Wedding of Paddy Brennan and Eileen Murphy', date: '8 Jun 1941', year: 1941, place: 'St Peter\u2019s, Phibsborough', people: ['p11', 'p19', 'p3', 'p9'], hue: 35 },
    { id: 'm3', kind: 'homestead', title: '12 Cabra Park', date: 'abt 1960', year: 1960, place: 'Cabra, Dublin', people: ['p11', 'p19'], hue: 95 },
    { id: 'm4', kind: 'certificate', title: 'Death certificate \u2013 Patrick Brennan', date: '1989', year: 1989, place: 'Dublin', people: ['p11'], hue: 0 },
    { id: 'm5', kind: 'census', title: '1911 Census return \u2013 Leinster Street North', date: '2 Apr 1911', year: 1911, place: 'Phibsborough, Dublin', people: ['p1', 'p2', 'p3', 'p5', 'p6'], hue: 45 },
    { id: 'm6', kind: 'portrait', title: 'James Brennan, tram driver', date: 'abt 1920', year: 1920, place: 'Dublin', people: ['p3'], hue: 200, primaryFor: 'p3' },
    { id: 'm7', kind: 'portrait', title: 'Pte Michael Brennan', date: '1915', year: 1915, place: 'Dublin', people: ['p5'], hue: 120, primaryFor: 'p5' },
    { id: 'm8', kind: 'grave', title: 'Brennan family plot, Glasnevin', date: '2015', year: 2015, place: 'Glasnevin Cemetery', people: ['p11', 'p19', 'p3', 'p9'], hue: 150 },
    { id: 'm9', kind: 'photo', title: 'Brennan children at Dollymount Strand', date: 'Jul 1952', year: 1952, place: 'Dollymount, Dublin', people: ['p20', 'p21', 'p22'], hue: 190 },
    { id: 'm10', kind: 'portrait', title: 'Eileen Brennan (n\u00e9e Murphy)', date: 'abt 1970', year: 1970, place: 'Dublin', people: ['p19'], hue: 330, primaryFor: 'p19' },
    { id: 'm11', kind: 'photo', title: 'Michael and Anne\u2019s wedding', date: '14 Jun 1969', year: 1969, place: 'Galway', people: ['p20', 'p27', 'p11', 'p19'], hue: 20, primaryFor: 'p20' },
    { id: 'm12', kind: 'document', title: 'Letter from Kate in Boston', date: 'Dec 1923', year: 1923, place: 'Boston, Massachusetts', people: ['p6', 'p2'], hue: 60 },
    { id: 'm13', kind: 'portrait', title: 'Annie Brennan (n\u00e9e Nolan)', date: 'abt 1935', year: 1935, place: 'Dublin', people: ['p9'], hue: 300, primaryFor: 'p9' },
    { id: 'm14', kind: 'photo', title: 'Christmas at Cabra Park', date: 'Dec 1985', year: 1985, place: 'Cabra, Dublin', people: ['p11', 'p19', 'p20', 'p27', 'p28', 'p29', 'p30'], hue: 10 },
    { id: 'm15', kind: 'portrait', title: 'David Brennan', date: '2024', year: 2024, place: 'Dublin', people: ['p28'], hue: 180, primaryFor: 'p28' },
    { id: 'm16', kind: 'portrait', title: 'Josephine Keogh', date: 'abt 1980', year: 1980, place: 'Dublin', people: ['p14'], hue: 280, primaryFor: 'p14' },
    { id: 'm17', kind: 'portrait', title: 'Anne Brennan', date: '2020', year: 2020, place: 'Galway', people: ['p27'], hue: 160, primaryFor: 'p27' },
    { id: 'm18', kind: 'portrait', title: 'Patrick Brennan, Mayo-born', date: 'abt 1925', year: 1925, place: 'Dublin', people: ['p1'], hue: 230, primaryFor: 'p1' }
  ];

  var notes = {
    p11: [
      { kind: 'note', body: 'Known to everyone as Paddy. Played hurling for Na Fianna in the 1930s.', by: 'Patricia', when: '3 weeks ago' },
      { kind: 'research', body: 'Check CIÉ staff records at the Irish Railway Record Society for exact promotion date.', by: 'David', when: '2 weeks ago' },
      { kind: 'todo', body: 'Scan the 1941 wedding photo at higher resolution (original with Patricia).', by: 'Siobh\u00e1n', when: '5 days ago', done: false }
    ],
    p1: [
      { kind: 'research', body: 'Birth year varies: 1858 on the 1901 census, 1856 on the death cert. Need baptism record from Swinford parish.', by: 'David', when: '1 month ago' }
    ],
    p5: [
      { kind: 'note', body: 'Commemorated on the Menin Gate. Letters home are with the Hughes cousins in Boston.', by: 'Conor', when: '2 months ago' }
    ]
  };

  var changes = [
    { when: '2 hours ago', actor: 'Siobh\u00e1n', action: 'upload', summary: 'Added photo \u201cChristmas at Cabra Park\u201d', target: 'm14', targetType: 'media' },
    { when: 'Yesterday', actor: 'Patricia', action: 'update', summary: 'Set death place of Gerard Brennan to Dublin', target: 'p22', targetType: 'person' },
    { when: 'Yesterday', actor: 'David', action: 'create', summary: 'Added event: Paddy Brennan \u2013 Occupation 1958, CI\u00c9 Broadstone', target: 'p11', targetType: 'person' },
    { when: '3 days ago', actor: 'Conor', action: 'create', summary: 'Added Rose Hughes (1920\u20132005), daughter of Kate and William Hughes', target: 'p18', targetType: 'person' },
    { when: '5 days ago', actor: 'Siobh\u00e1n', action: 'create', summary: 'Added research to-do on Paddy Brennan', target: 'p11', targetType: 'person' },
    { when: '1 week ago', actor: 'David', action: 'update', summary: 'Changed birth of Patrick Brennan from \u201c1856\u201d to \u201cabt 1858\u201d', target: 'p1', targetType: 'person' },
    { when: '2 weeks ago', actor: 'Patricia', action: 'create', summary: 'Added Nora Brennan (n\u00e9e Byrne) as partner of Thomas Brennan', target: 'p23', targetType: 'person' },
    { when: '3 weeks ago', actor: 'Conor', action: 'upload', summary: 'Added document \u201cLetter from Kate in Boston\u201d', target: 'm12', targetType: 'media' }
  ];

  var contributors = [
    { id: 'c1', handle: 'david', name: 'David', role: 'admin', lastSeen: 'Today', edits: 142, self: 'p28', sessions: 2 },
    { id: 'c2', handle: 'siobhan', name: 'Siobh\u00e1n', role: 'contributor', lastSeen: '2 hours ago', edits: 58, self: 'p29', sessions: 1 },
    { id: 'c3', handle: 'patricia', name: 'Patricia', role: 'contributor', lastSeen: 'Yesterday', edits: 37, self: 'p21', sessions: 1 },
    { id: 'c4', handle: 'conor', name: 'Conor', role: 'contributor', lastSeen: '3 days ago', edits: 21, self: 'p30', sessions: 1 },
    { id: 'c5', handle: 'catherine', name: 'Catherine K', role: 'contributor', lastSeen: '2 months ago', edits: 4, self: 'p26', sessions: 0 }
  ];

  var invites = [
    { id: 'inv1', purpose: 'register', code: 'N8KQ2M', label: 'for Aoife', usedAt: null, expires: 'in 26 days' },
    { id: 'inv2', purpose: 'register', code: 'F3PL7W', label: null, usedAt: null, expires: 'in 12 days' }
  ];

  return {
    tree: { name: 'Brennan Family Tree', shareCode: 'K7PX2Q', homePerson: 'p28' },
    me: { name: 'David', role: 'admin', self: 'p28' },
    invites: invites,
    persons: persons,
    families: families,
    events: events,
    media: media,
    notes: notes,
    changes: changes,
    contributors: contributors
  };
})();

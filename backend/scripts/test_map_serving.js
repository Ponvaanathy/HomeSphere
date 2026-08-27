const testHtml = async () => {
  const html = await fetch('http://localhost:5000/map-search.html').then(r => r.text());
  console.log('📄 map-search.html length:', html.length, 'bytes');
  console.log('✅ fullInteractiveMap container:', html.includes('id="fullInteractiveMap"'));
  console.log('✅ btnGpsCurrentLoc (GPS button):', html.includes('id="btnGpsCurrentLoc"'));
  console.log('✅ locationIntelligencePanel:', html.includes('id="locationIntelligencePanel"'));
  console.log('✅ mapLifeScoreRadarCanvas:', html.includes('id="mapLifeScoreRadarCanvas"'));
  console.log('✅ amenitiesDropdownPanel:', html.includes('id="amenitiesDropdownPanel"'));
  console.log('✅ btnSearchThisArea:', html.includes('id="btnSearchThisArea"'));
  console.log('✅ listingTypeChips:', html.includes('id="listingTypeChips"'));
  console.log('✅ radiusSelectorGroup:', html.includes('id="radiusSelectorGroup"'));
};
testHtml();

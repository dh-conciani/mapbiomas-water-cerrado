// export statistics to inspect mapbiomas agua sentinel improvement 
// dhemerson.costa@ipam.org.br 

// set years
var years = [2017, 2018, 2019, 2020, 2021, 2022, 2023];

// set months
var months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

// set cloud cover
var cloudCover = 50;

// set biome id
var biome_id = 4;

// read biomes
var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster');
var biomes_vec = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/biomas-2019');

// read states 
var states = ee.Image('projects/mapbiomas-workspace/AUXILIAR/estados-2016-raster');

// get territories in which statistics will be processed (set biome id here)
var territory = states.updateMask(biomes.eq(biome_id));
Map.addLayer(territory.randomVisualizer(), {}, 'territory', false);

// get sentinel data 
var collection_S2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(biomes.updateMask(biomes.eq(biome_id)).geometry())
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudCover));
  //.map(function(image_i) {
  //  return image_i.updateMask(territory);
  //});
                            
Map.addLayer(collection_S2)
print(collection_S2.size())
Map.addLayer(biomes.updateMask(biomes.eq(biome_id)).geometry())

565504

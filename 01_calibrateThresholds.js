// export statistics to inspect mapbiomas agua sentinel improvement 
// dhemerson.costa@ipam.org.br 

// set calibration parameters
var loss_s2 = -0.30;
var gain_s2 = 0.50;

// set years
var years = [2017, 2018, 2019, 2020, 2021, 2022, 2023];

// set months
var months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

// set cloud cover
var cloudCover = 50;

// set biome id
var bioma = 'Cerrado';

// read biomes
var biomes_vec = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/biomas-2019')
  .filter(ee.Filter.eq('Bioma', bioma));

// get sentinel data 
var collection_s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(biomes_vec)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudCover));
  
// get landsat data
var collection_L8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(biomes_vec)
  .filter(ee.Filter.lt('CLOUD_COVER_LAND', cloudCover));
                   
//Map.addLayer(collection_S2)
//print(collection_S2.size())
//Map.addLayer(biomes.updateMask(biomes.eq(biome_id)).geometry())



print(collection_L8)
print(collection_s2)

565504

// read states 
//var states = ee.Image('projects/mapbiomas-workspace/AUXILIAR/estados-2016-raster');
//var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster');

// get territories in which statistics will be processed (set biome id here)
//var territory = states.updateMask(biomes.eq(biome_id));
//Map.addLayer(territory.randomVisualizer(), {}, 'territory', false);

// export statistics to inspect mapbiomas agua sentinel improvement 
// dhemerson.costa@ipam.org.br 

// set calibration parameters
var loss_s2 = -0.30;
var gain_s2 = 0.50;

// set years
//var years = [2017, 2018, 2019, 2020, 2021, 2022, 2023];
var years = [2022];

// set months
//var months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
var months = ['9'];

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
  
// set fixed parameters
var pmtro_focal = {radius: 50, units: 'meters'};

// sub-pixel endmembers
var endmembers = [
    [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0], /*gv*/
    [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /*npv*/
    [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /*soil*/
    [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0] /*cloud*/
];

// sentinel-2 kernel 
var kernelS2 = ee.Kernel.circle({radius: 2, units: 'pixels', magnitude: 1});
var gaussianKernel = ee.Kernel.gaussian(3, 2, 'pixels', true, 2);

// compute terrain models 
var srtmBrasil = ee.Image('USGS/SRTMGL1_003').select("elevation");
var terrain = ee.call('Terrain', srtmBrasil.convolve(gaussianKernel));

function radians(img) { return img.toFloat().multiply(3.1415927).divide(180); }
var slope = radians(terrain.select(['slope'])).lt(0.076).clip(biomes_vec.geometry());
slope = slope.focal_max(pmtro_focal).focal_min(pmtro_focal);

// set s2 cloud mask function
var maskS2clouds = function (image) {
    var cloudProb = image.select('MSK_CLDPRB');
    // var snowProb = image.select('MSK_SNWPRB');
    var cloud = cloudProb.eq(0);
    var scl = image.select('SCL'); 
    var shadow = scl.eq(3); // 3 = cloud shadow
    var cirrus = scl.eq(10); // 10 = cirrus
    // Cloud probability less than 10% or cloud shadow classification
    var mask = cloud.and(cirrus.neq(1)).and(shadow.neq(1));
    return image.updateMask(mask);
};

// Function to cloud mask from the pixel_qa band of Landsat 8 SR data.
var maskL8sr = function (image) {
    // Bits 3 and 5 are cloud shadow and cloud, respectively.
    var cloudShadowBitMask = 1 << 3;
    var cloudsBitMask = 1 << 5;

    // Get the pixel QA band.
    var qa = image.select('QA_PIXEL');

    // Both flags should be set to zero, indicating clear conditions.
    var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                .and(qa.bitwiseAnd(cloudsBitMask).eq(0));

    // Return the masked image.
    return image.updateMask(mask);
};

// compute statistics
// for each year 
years.forEach(function(year_i) {
  // for each month
  months.forEach(function(month_j) {
    
    // read water data
    var water = ee.ImageCollection('projects/mapbiomas-workspace/TRANSVERSAIS/AGUA5-FT')
      .filter("version == '11'").filter("cadence == 'monthly'")
      .filter("year < 2022").select("classification_" + month_j)
      .filter(ee.Filter.eq("biome", bioma.toUpperCase())).sum()
      .gt(0)//.selfMask();;
      print(water)

    
  })
})


565504

// read states 
//var states = ee.Image('projects/mapbiomas-workspace/AUXILIAR/estados-2016-raster');
//var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster');

// get territories in which statistics will be processed (set biome id here)
//var territory = states.updateMask(biomes.eq(biome_id));
//Map.addLayer(territory.randomVisualizer(), {}, 'territory', false);

// export statistics to calibrate mapbiomas agua sentinel-landsat integration  
// an adaptation of dhemerson.costa@ipam.org.br from bruno@imazon.org.br codes

// set calibration parameters
var loss_s2 = [-0.30];
var gain_s2 = [0.50];

// set years
//var years = [2017, 2018, 2019, 2020, 2021, 2022, 2023];
var years = [2023];

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

var hand30_1000 =  ee.Image('users/gena/GlobalHAND/30m/hand-1000');
var expresion = "(b(0) <= 5.3) ? 0 : (b(0) <= 15 && b(0) > 5.3 ) ? 1 : (b(0) > 15 && b(1) == 0 ) ? 2   : (b(0) > 15 && b(1) == 1 ) ? 3 : 0"  
var hand_class = hand30_1000.addBands(slope).expression(expresion).clip(biomes_vec.geometry());


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

// Applies scaling factors in S2
function applyScaleFactors(image) {
    var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
    var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
    return image.addBands(opticalBands, null, true)
                .addBands(thermalBands, null, true);
}

// set spectral mixture analisys function 
var sma = function (image) {
      
    var outBandNames = ['gv', 'npv', 'soil', 'cloud'];
    var fractions = ee.Image(image)
                      .select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12'])
                      .unmix(endmembers).max(0)
                      .multiply(100).byte();
    
    fractions = fractions.rename(outBandNames);
    var summed = fractions.expression('b("gv") + b("npv") + b("soil")');
    
    var shade = summed.subtract(100)
                      .abs().byte().rename("shade");
    
    fractions = fractions.addBands(shade);
    // return ee.Image(fractions.copyProperties(image));
    return image.addBands(fractions);
};

// set membership function 
var membership = function (image){
    var gv_soil = image.select('gv').addBands(image.select('soil')).reduce(ee.Reducer.sum());
    
    var cond_1 = image.select('shade').multiply(0.1).subtract(6.5).clamp(0, 1);
    var cond_2 = gv_soil.multiply(-0.1).add(1).clamp(0, 1);
    var cond_3 = image.select('cloud').multiply(-0.1).add(3.5).clamp(0, 1)
                  .addBands(image.select('cloud').multiply(0.125).clamp(0, 1)  
                  ).reduce(ee.Reducer.min());
    
    var image_prob = cond_1.addBands(cond_2).addBands(cond_3).reduce(ee.Reducer.mean());
    return image_prob.rename("SWSC");
};


// compute statistics
// for each year 
years.forEach(function(year_i) {
  // for each month
  months.forEach(function(month_j) {
    
    // read water data
    var water = ee.ImageCollection('projects/mapbiomas-workspace/TRANSVERSAIS/AGUA5-FT')
      .filter("version == '11'").filter("cadence == 'monthly'")
      .filter("year == " + year_i).select("classification_" + month_j)
      .filter(ee.Filter.eq("biome", bioma.toUpperCase())).sum()
      .gt(0);
    
    // read L8 
    var L8_ij =  collection_L8
      .filterDate(ee.Date.fromYMD(year_i, ee.Number.parse(month_j), 1),
                  ee.Date.fromYMD(year_i, ee.Number.parse(month_j), 1).advance(1,'month'))
      .map(maskL8sr).map(applyScaleFactors)
      .median();
                        
    // read s2
    var s2_ij = collection_s2
      .filterDate(ee.Date.fromYMD(year_i, ee.Number.parse(month_j), 1),
                  ee.Date.fromYMD(year_i, ee.Number.parse(month_j), 1).advance(1,'month'))                         
                  .map(maskS2clouds)
                  .map(sma)
                  .map(membership)
                  .median();
    
        // read s2
    var s2_ijk = collection_s2
      .filterDate(ee.Date.fromYMD(year_i-1, ee.Number.parse(month_j), 1),
                  ee.Date.fromYMD(year_i-1, ee.Number.parse(month_j), 1).advance(1,'month'))                         
                  .map(maskS2clouds)
                  .map(sma)
                  .map(membership)
                  .median();
    
    // get change in S2 among years
    var s2Change = s2_ij.select('SWSC')
                    .subtract(s2_ijk.select('SWSC'))
                    .rename('SWSC Change');
    
    
    Map.addLayer(water, {}, 'L8 ' + year_i + ' - ' + month_j, false);

    // apply thresholds over s2 deltas 
    // set temp image
    var temp_img = ee.Image([]);
    
    // for each loss paramenters
    loss_s2.forEach(function(loss_ijk) {
      
      var s2Loss = s2Change.lte(loss_ijk).selfMask().updateMask(water)
        // set properties
        .set({'parameter': 'loss'})
        .set({'value': loss_ijk})
        .rename('loss');
        
        Map.addLayer(s2Loss, {}, 'S2 Loss ' + year_i + ' - ' + month_j + ' - Param. ' + loss_ijk, false);

        // store
        temp_img = temp_img.addBands(s2Loss);
    });
    
    // for each gain parameters
    gain_s2.forEach(function(gain_ijk) {
      
      var s2Gain = s2Change.gte(gain_ijk).selfMask().updateMask(hand_class.lte(1))
        // retain only gains different of already classified by L8
        .updateMask(water.unmask(0).neq(1))
        // set properties
        .set({'parameter': 'gain'})
        .set({'value': gain_ijk})
        .rename('gain');
        
        Map.addLayer(s2Gain, {}, 'S2 Gain ' + year_i + ' - ' + month_j + ' - Param. ' + gain_ijk, false);
        
        // store
        temp_img = temp_img.addBands(s2Gain);
    });
    
    //var s2Gain = swscChange.gte(thrs_gain_s2).selfMask().updateMask(hand_class.lte(1));
    
    

    
  })
})


565504

// read states 
//var states = ee.Image('projects/mapbiomas-workspace/AUXILIAR/estados-2016-raster');
//var biomes = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster');

// get territories in which statistics will be processed (set biome id here)
//var territory = states.updateMask(biomes.eq(biome_id));
//Map.addLayer(territory.randomVisualizer(), {}, 'territory', false);

var l5_col_2 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2');
var l7_col_2 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2');    
l7_col_2 = l7_col_2.filterDate('1995-01-01', '2012-12-31');
var l8_col_2 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
var l9_col_2 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2');

function applyScaleFactors(image) {
      var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2).multiply(10000);
      return image.addBands(opticalBands, null, true)
           .uint16()
           .copyProperties(image);
}

l5_col_2 = l5_col_2.map(applyScaleFactors);
l7_col_2 = l7_col_2.map(applyScaleFactors);
l8_col_2 = l8_col_2.map(applyScaleFactors);
l9_col_2 = l9_col_2.map(applyScaleFactors);

var bandnamed = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'];
var bands_l5_2 = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'];
var bands_l7_2 = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'];
var bands_l8_2 = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];
var bands_l9_2 = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'];
var bandnamed = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'];

var endmembers = [
      [119.0, 475.0, 169.0, 6250.0, 2399.0, 675.0], /*gv*/
      [1514.0, 1597.0, 1421.0, 3053.0, 7707.0, 1975.0], /*npv*/
      [1799.0, 2479.0, 3158.0, 5437.0, 7707.0, 6646.0], /*soil*/
      [4031.0, 8714.0, 7900.0, 8989.0, 7002.0, 6607.0] /*cloud*/
  ];

var sma = function (image) {
      var outBandNames = ['gv', 'npv', 'soil', 'cloud'];
      var fractions = ee.Image(image)
          .select(bandnamed)
          .unmix(endmembers)
          .max(0)
          .multiply(100)
          .byte();
      
      fractions = fractions.rename(outBandNames);
      
      var summed = fractions.expression('b("gv") + b("npv") + b("soil")');
      
      var shade = summed
          .subtract(100)
          .abs()
          .byte()
          .rename("shade"); 
      
      fractions = fractions.addBands(shade);
      
      // return ee.Image(fractions.copyProperties(image));
      return image.addBands(fractions);
  };

var cloudScore = function (image) {
  
  var rescale = function (obj) {
  
      var image = obj.image.subtract(obj.min).divide(ee.Number(obj.max).subtract(obj.min));
  
      return image;
  };
  
      var cloudThresh = 10;
  
      // Compute several indicators of cloudiness and take the minimum of them.
      var score = ee.Image(1.0);
  
      // Clouds are reasonably bright in the blue band.
      score = score.min(rescale({
          'image': image.select(['blue']),
          'min': 1000,
          'max': 3000
      }));
  
      // Clouds are reasonably bright in all visible bands.
      score = score.min(rescale({
          'image': image.expression("b('red') + b('green') + b('blue')"),
          'min': 2000,
          'max': 8000
      }));
  
      // Clouds are reasonably bright in all infrared bands.
      score = score.min(rescale({
          'image': image.expression("b('nir') + b('swir1') + b('swir2')"),
          'min': 3000,
          'max': 8000
      }));
  
      // However, clouds are not snow.
      var ndsi = image.normalizedDifference(['green', 'swir1']);
  
      score = score.min(rescale({
          'image': ndsi,
          'min': 0.8000,
          'max': 0.6000
      })).multiply(100).byte();
  
      var cond = score.lt(cloudThresh);

      return image.updateMask(cond);
  };
  
var process_image = function (image) {
    return sma(image.clip(geometry_teste));
  };

var rename_bands = function (imgCol, input) {
  return imgCol.select(input, bandnamed);
};
 
var l5_ready = rename_bands(l5_col_2, bands_l5_2).map(process_image);
var l7_ready = rename_bands(l7_col_2, bands_l7_2).map(process_image);
var l8_ready = rename_bands(l8_col_2, bands_l8_2).map(process_image);
var l9_ready = rename_bands(l9_col_2, bands_l9_2).map(process_image);

var collectionLandsat = l5_ready.merge(l7_ready).merge(l8_ready).filterBounds(geometry_teste).filter(ee.Filter.lte('CLOUD_COVER', 70)).map(cloudScore);
var modules =  require('users/brunoferreira/gtagua_base:module_mapbiomas_agua_2022_moving_window_4');
var p_img_month_func = modules.p_img_month_func;

var color_prob = ['a50026','d73027','f46d43','fdae61','fee090','ffffbf','e0f3f8','abd9e9','74add1','4575b4','313695']

// ----------------------------------------------------------------------------------------------------------------------------------------------------

// dhemerson.costa@ipam.org.br - joaquim.pereira@ipam.org.br - wallace.silva@ipam.org.br
// filtro de reservatorios usando falso positivo 

// read mapbiomas false-positive
var fp_collection = ee.ImageCollection("projects/mapbiomas-workspace/AMOSTRAS/GTAGUA/OBJETOS/CLASSIFICADOS/TESTE_1_raster")
  .filter(ee.Filter.eq("version", "2"))
  .filter(ee.Filter.eq("biome", 'CERRADO'));

print('false-positive collection', fp_collection);

// read mapbiomas water monthly collection
var water0 = ee.ImageCollection('users/wwfrioparaguai/MapBiomasAGUA/iteration_2');
var water1 = ee.ImageCollection.fromImages([
            ee.Image("projects/mapbiomas-workspace/TRANSVERSAIS/GTAGUA/2021/iteartion3/iteration_3_2021"),
            ee.Image("projects/mapbiomas-workspace/TRANSVERSAIS/GTAGUA/2021/iteartion3/iteration_3_2022_12"),
            ee.Image("projects/mapbiomas-workspace/TRANSVERSAIS/GTAGUA/2023/ITERATION3/iteration_3_2023_T12")
             ]);
var water_collection = water0.merge(water1); 

// standardize bandnames
water_collection = water_collection.map(function(image) {
  return image.rename('w_1', 'w_2', 'w_3', 'w_4', 'w_5', 'w_6', 'w_7', 'w_8', 'w_9', 'w_10', 'w_11', 'w_12');
});

print('water collection', water_collection);

// cerrado mask
var limit = ee.Image("projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster");

/*
// set years to be processed
var yearsList = [
  //1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998,
  //1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012,
  //2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022
  2020];
*/

// needs to create a conditional for 2023 (uses 2022 fp)
var yearsList = [2022];

// set years to be processed
var monthList = [9];

// set empty image
var recipe = ee.Image([]);

// for each year
yearsList.forEach(function(year_i) {
  // get data for the year i
  var fp_i = fp_collection.filterMetadata('year', 'equals', year_i).mosaic().eq(5).selfMask();  
  var water_i = water_collection.filterMetadata('year', 'equals', year_i);     
  
  Map.addLayer(fp_i.randomVisualizer(), {}, 'fp ' + year_i, false);
  //Map.addLayer(water_i, {}, 'water ' + year_i, false);
  
  // for each month 
  monthList.forEach(function(month_j) {
    // get water for year i & month j
    var water_ij = water_i.select('w_' + month_j).mosaic().updateMask(limit.eq(4)).selfMask();
    
    Map.addLayer(water_ij, {palette: ['blue'], min:1, max:1}, 'water ' + year_i  + '-' + month_j);
    print(water_ij)
  })
  
})

/*


monthList.forEach(function(month_i) {
  
  var pronMensal = p_img_month_func(2023, month_i, collectionLandsat);

  Map.addLayer(pronMensal, {palette:color_prob, min:0, max:1}, "Membership mensal " + month_i);

  // get data for year [i]
  var data_i = collection.filter(ee.Filter.eq('year', year)).mosaic();
  
  // get only water surface
  var surface_i = ee.Image("projects/mapbiomas-workspace/TRANSVERSAIS/GTAGUA/2023/ITERATION3/iteration_3_2023_T12")
                  .select("w_" + month_i).updateMask(limit.eq(4)).selfMask();
  
  // get only fp
  //var fp_i = data_i.min().eq(5).selfMask();
  var fp_i = data_i.eq(5).selfMask();

  // get unique ids for false positives
  var fp_id = fp_i.connectedComponents({
    connectedness: ee.Kernel.plus(1),
    maxSize: 128
    }).reproject('EPSG:4326', null, 30);
  
  // get buffer from water surface
  var surface_iBuffer = surface_i.distance(ee.Kernel.euclidean(30, 'meters'), false).selfMask();
  
  // mask false positive Ids
  var Ids = fp_id.updateMask(surface_iBuffer)
      .select('labels'); // Seleciona apenas a banda de rótulos dos IDs
  
    //Map.addLayer(data_i.randomVisualizer(), {}, 'all', false);
  Map.addLayer(surface_iBuffer, {palette: ['blue'], min:1, max:1}, 'water surface ' + month_i);
  Map.addLayer(fp_id.randomVisualizer(), {}, 'false-positive IDs ' + month_i);
  //Map.addLayer(Ids.randomVisualizer(), {}, 'IDs to retain');

  // proximos passsos
  // 1- recuperar a lista de ids no objeto 'Ids' 
  // 2- filtrar o objeto 'fp_id' e reter apenas os valores que existirem no objeto 'Ids'
  // 3- fazer um blend entre o objeto filtrado e o objeto 'surface_i'

  // Cálculo da tabela de IDs
  var ids_table = Ids.select('labels').reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: geometry_teste,
    // geometry: geometry_cerrado,
    scale: 30,
    maxPixels: 1e13,
  });
  
  var ids = ee.Dictionary(ids_table.get('labels')).keys();
  
  var ids_blend = ee.ImageCollection(ids.map(function(id){
      var new_image = fp_id.select('labels').eq(ee.Number.parse(id)).where(pronMensal.lt(0.5),0).selfMask();
      return new_image;
  })).mosaic();
  
  // Adiciona a camada de visualização dos IDs blend
  Map.addLayer(ids_blend,{palette:['ff0000']},'ids_blend');
  
  // Máscara final: blend entre a superfície de água original e os IDs blend
  var final_img_year = surface_i
    .addBands(ids_blend)
    .reduce("max")
    .rename(
      //data_i.bandNames()
      'classification'
      );
  
  // Adiciona a camada de visualização da imagem final do ano
  Map.addLayer(final_img_year,{palette:['404080']},'final_img_year');
  
  // final guardar resultado na saida 'recipe' 
  recipe = recipe.addBands(final_img_year);
});


print(recipe)

*/

## get factor water

library(ggplot2)

## set root
root <- './table/'

## list files
files <- list.files(root, full.names= TRUE)

## avoid sci notation
options(scipen=9e3)

## merge tables
data <- as.data.frame(NULL)
for(i in 1:length(unique(files))) {
  ## read file
  x <- read.csv(files[i])
  ## bind
  data <- rbind(x, data)
}

## aggregate per biome
y <- aggregate(x= list(area= data$area), by= list(month= data$month, bandName= data$bandName), FUN= 'sum')

# Multiply 'area' by -1 where 'bandName' is 'loss'
y$area[y$bandName == 'loss'] <- y$area[y$bandName == 'loss'] * -1

## plot
ggplot(data= y, mapping= aes(x= as.factor(month), y= area/1e3, group= bandName, colour= bandName)) +
  geom_line() +
  geom_point() +
  scale_colour_manual('S2 Diff. ~ L8', values= c('forestgreen', 'red'), labels= c('Gain', 'Loss')) +
  theme_minimal() +
  geom_hline(yintercept=0, linetype= 'dashed')  +
  xlab('Month') +
  ylab('Área (Kha)')





names(data)

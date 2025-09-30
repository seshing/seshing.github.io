---
title: "Paper: Revealing spatio-temporal evolution of urban visual environments with street view imagery"
meta_title: ""
description: "This study presents an embedding-driven clustering approach that combines physical and perceptual attributes to analyze the spatial structure and spatio-temporal evolution of urban visual environments. Using Singapore as a case study, it leverages street view imagery and graph neural networks to classify streetscapes into six clusters, revealing changes over the past decade. The findings provide insights into urban visual dynamics, supporting planning and landscape improvement."
date: 2024-06-30
image: "/images/blog/07-laup-visual-change/thumbnail.jpeg"
categories: ["Paper"]
author: "Xiucheng"
tags: ["human perception", "computer vision", "street view"]
draft: false
publications:
  - title: "Revealing spatio-temporal evolution of urban visual environments with street view imagery"
    authors:
      - "**Xiucheng Liang**, Tianhong Zhao, Filip Biljecki"
    paper_info: "Published in Landscape and Urban Planning, 2023"
    pdf_link: "https://ual.sg/publication/2023-landup-svi-evolution/2023-landup-svi-evolution.pdf"
    doi_link: "https://doi.org/10.1016/j.landurbplan.2023.104802"
    bibtex: |
      @article{liang2023revealing,
      title={Revealing spatio-temporal evolution of urban visual environments with street view imagery},
      author={Liang, Xiucheng and Zhao, Tianhong and Biljecki, Filip},
      journal={Landscape and Urban Planning},
      volume={237},
      pages={104802},
      year={2023},
      publisher={Elsevier}
      }
---

### Abstract

<div class="text-xl leading-relaxed text-gray-800 dark:text-gray-200">
The visual landscape plays a pivotal role in urban planning and healthy cities. Recent studies of visual evaluation focus on either objective or subjective approach, while describing the visual character holistically and monitor its evolution remains challenging. This study introduces an embedding-driven clustering approach that integrates both physical and perceptual attributes to infer the spatial structure of the visual environment, and investigates its spatio-temporal evolution. Singapore, a highly urbanised yet green city, is selected as a case study. 
</div>

</br>
<div class="text-xl leading-relaxed text-gray-800 dark:text-gray-200">
Firstly, a visual feature matrix is derived from street view imagery (SVI). Then, a graph neural network is constructed based on road connections to encode visual features and spatial dependency leading to a clustering algorithm that is used to discover the underlying characteristics of the visual environment. The implementation characterises streetscapes of the city-state into six types of clusters. Finally, taking advantage of historical SVI, a longitudinal analysis reveals how visual clusters have evolved in the past decade. Among them, one of the clusters represents high-density visual experience, affirming the work as such streetscape dominates the central business district and it is evolving elsewhere, mirroring the expansion of new towns. In turn, another identified cluster, indicating sparse landscapes, decreased, while areas that are considered to be in the most visually pleasant cluster, increased. For the first time, this study demonstrates a novel method to understand the urban visual structure and analyse its spatio-temporal evolution, which could support future planning decision-making and urban landscape betterment.
</div>

</br>

<!-- ![Distribution of visual clusters](/images/blog/07-laup-visual-change/distribution.jpeg) -->
<!-- ![Distribution of visual clusters](/images/blog/07-laup-visual-change/alluvium.jpeg) -->

![](/images/blog/07-laup-visual-change/distribution.jpeg)
<div class="flex gap-4 justify-center">
  <img src="/images/blog/07-laup-visual-change/distribution.jpeg" alt="example1" class="w-3/4">
</div>

</br>

![](/images/blog/07-laup-visual-change/alluvium.jpeg)
<div class="flex gap-4 justify-center">
  <img src="/images/blog/07-laup-visual-change/alluvium.jpeg" alt="example2" class="w-3/4">
</div>



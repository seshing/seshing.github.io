---
title: "Paper: Heterogeneous graph neural networks for building attribute prediction from hierarchical urban features and cross-view imagery"
meta_title: ""
description: "In this work, we introduce a pipeline that integrates hierarchical urban features and cross-view imagery (remote sensing + street view) into a heterogeneous urban graph for building attribute prediction."
date: 2026-03-02
image: "/images/blog/14-isprs2/urbanity.jpg"
categories: ["Paper"]
author: "Xiucheng"
tags: ["graph nerual networks", "computer vision", "street view"]
draft: false
publications:
  - title: "Heterogeneous graph neural networks for building attribute prediction from hierarchical urban features and cross-view imagery"
    authors:
      - "**Xiucheng Liang**, Winston Yap, Filip Biljecki"
    paper_info: "Published in ISPRS Journal of Photogrammetry and Remote Sensing, 2026"
    pdf_link: "https://ual.sg/publication/2026-ijprs-gnn/2026-ijprs-gnn.pdf"
    code_link: "https://github.com/seshing/HeteroGNN-building-attribute-prediction/"
    doi_link: "https://doi.org/10.1016/j.isprsjprs.2026.02.016"
    bibtex: |
      @article{liang2026heterognn,
      title = {Heterogeneous Graph Neural Networks for Building Attribute Prediction from Hierarchical Urban Features and Cross-View Imagery},
      author = {Liang, Xiucheng and Yap, Winston and Biljecki, Filip},
      year = 2026,
      journal = {ISPRS Journal of Photogrammetry and Remote Sensing},
      volume = {234},
      pages = {185--204},
      issn = {0924-2716},
      }
---

<!--more-->
### Abstract
<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
Data on building properties are essential for a variety of urban applications, yet such information remains scarce in many parts of the world. Recent efforts have leveraged instruments such as machine learning (ML), computer vision (CV), and graph neural networks (GNNs) to assess these properties at scale by leveraging urban features or visual information.
However, extracting holistic representations to infer building attributes from multi-modal data across multiple spatial scales and vertical building characteristics remains a significant challenge.
</div>

</br>
<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
To bridge this gap, we present a innovative framework, that captures both hierarchical urban features and cross-view visual information through a heterogeneous graph. First, we construct a heterogeneous graph that incorporates multi-dimensional urban elements --- buildings, streets, intersections, and urban plots --- to comprehensively represent multi-scale geospatial features. 
</div>

</br>
{{< image src="images/blog/14-isprs2/urbanity_full.jpg" caption="Constructing heterogeneous urban graph with four element types (buildings, street segments, intersections, and urban plots)." alt="" height="" width="" position="center" command="fill" option="q100" class="img-80" title=""  webp="false" >}}
</br>

</br>
<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
Second, we automatically crop images of individual buildings from both very high-resolution satellite and street-level imagery, and introduce feature propagation on semantic similarity graphs to supplement missing facade information. Third, feature fusion is applied to integrate both morphological and visual features, with holistic representations generated for building attribute prediction.
</div>

</br>
{{< image src="images/blog/14-isprs2/data_fusion_framework.jpg" caption="Generating holistic building representations to support building attribute prediction." alt="" height="" width="" position="center" command="fill" option="q100" class="img-80" title=""  webp="false" >}}
</br>

</br>
{{< image src="images/blog/14-isprs2/architecture.jpg" caption="Illustration of the heterogeneous GraphSAGE framework for building attribute prediction." alt="" height="" width="" position="center" command="fill" option="q100" class="img-100" title=""  webp="false" >}}
</br>

</br>
<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200"><div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
Systematic experiments across three global cities demonstrate that our method outperforms existing CV, ML, and homogeneous GNN-based models, achieving classification accuracies of 86% to 96% across 10 to 12 distinct building types, with mean F1 scores ranging from 0.70 to 0.73. The framework demonstrates robustness to class imbalance and produces more distinctive embeddings for ambiguous categories. In additional task of inferring building age, the method delivers similarly strong performance.
</div>

</br>
{{< image src="images/blog/14-isprs2/performance.png" caption="Model performance." alt="" height="" width="" position="center" command="fill" option="q100" class="img-100" title=""  webp="false" >}}
</br>

<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
This framework advances scalable approaches for filling gaps in building attribute data and offers new insights into modeling holistic urban environments.
</div>



<!-- ![](/images/blog/10-cupum-bd-caption/framework.jpg) -->
<!-- <figure style="display:flex;flex-direction:column;align-items:center;">
    <img src="/images/blog/10-cupum-bd-caption/framework.jpg" alt="Research framework" style="width:90%;height:auto;">
</figure> -->


<!-- ![](/images/blog/10-cupum-bd-caption/examples_all.jpeg) -->
<!-- <figure style="display:flex;flex-direction:column;align-items:center;">
    <img src="/images/blog/10-cupum-bd-caption/examples_all.jpeg" alt="Building clusters" style="width:90%;height:auto;">
</figure> -->


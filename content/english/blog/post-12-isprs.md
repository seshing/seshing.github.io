---
title: "Paper: OpenFACADES: An open framework for architectural caption and attribute data enrichment via street view imagery"
meta_title: ""
description: "We introduce an open framework leveraging multimodal data to enrich building profiles with objective attributes and semantic descriptors. It automates facade detection, reprojects panoramic views, and predicts multi-attribute data."
date: 2025-10-30
image: "/images/blog/12-isprs/dashboard.gif"
categories: ["Paper"]
author: "Xiucheng"
tags: ["LLM", "computer vision", "street view"]
draft: false
publications:
  - title: "OpenFACADES: an open framework for architectural caption and attribute data enrichment via street view imagery"
    authors:
      - "**Xiucheng Liang**, Jinheng Xie, Tianhong Zhao, Rudi Stouffs, Filip Biljecki"
    paper_info: "Published in ISPRS Journal of Photogrammetry and Remote Sensing, 2025"
    pdf_link: "https://arxiv.org/pdf/2504.02866"
    doi_link: "https://doi.org/10.1016/j.isprsjprs.2025.10.014"
    code_link: "https://github.com/seshing/OpenFACADES"
    bibtex: |
      @article{liang2025openfacades,
      title = {OpenFACADES: An open framework for architectural caption and attribute data enrichment via street view imagery},
      author = {Liang, Xiucheng and Xie, Jinheng and Zhao, Tianhong and Stouffs, Rudi and Biljecki, Filip},
      year = 2025,
      month = dec,
      journal = {ISPRS Journal of Photogrammetry and Remote Sensing},
      volume = {230},
      pages = {918--942},
      issn = {0924-2716}
      }
---

<!--more-->
### Abstract
<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
Building properties, such as height, usage, and material, play a crucial role in spatial data infrastructures, supporting various urban applications.
Despite their importance, comprehensive building attribute data remain scarce in many urban areas.
Recent advances have enabled the extraction of objective building attributes using remote sensing and street-level imagery. 
However, establishing a pipeline that integrates diverse open datasets, acquires holistic building imagery, and infers comprehensive building attributes at scale remains a significant challenge.
</div>

</br>
{{< image src="images/blog/12-isprs/overview.jpg" caption="" alt="" height="" width="" position="center" command="fill" option="q100" class="img-80" title=""  webp="false" >}}
</br>

</br>
<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
Among the first, this study bridges the gaps by introducing <strong>OpenFACADES</strong>, an open framework that leverages multimodal crowdsourced data to enrich building profiles with both objective attributes and semantic descriptors through multimodal large language models.
First, we integrate street-level image metadata from Mapillary with OpenStreetMap geometries via isovist analysis, identifying images that provide suitable vantage points for observing target buildings. 
Second, we automate the detection of building facades in panoramic imagery and tailor a reprojection approach to convert objects into holistic perspective views that approximate real-world observation.
</div>

</br>
{{< image src="images/blog/12-isprs/retrive_bd_img.jpg" caption="" alt="" height="" width="" position="center" command="fill" option="q100" class="img-80" title=""  webp="false" >}}
</br>

</br>
<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200"><div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
Third, we introduce an innovative approach that harnesses and investigates the capabilities of open-source large vision-language models (VLMs) for multi-attribute prediction and open-vocabulary captioning in building-level analytics, leveraging a globally sourced dataset of 31,180 labeled images from seven cities.
</div>

</br>
{{< image src="images/blog/12-isprs/annotations.gif" caption="" alt="" height="" width="" position="center" command="fill" option="q100" class="img-80" title=""  webp="false" >}}
</br>

<div class="text-2xl leading-relaxed font-light text-gray-800 dark:text-gray-200">
Evaluation shows that fine-tuned VLM excel in multi-attribute inference, outperforming single-attribute computer vision models and zero-shot ChatGPT-4o. Further experiments confirm its superior generalization and robustness across culturally distinct region and varying image conditions. Finally, the model is applied for large-scale building annotation, generating a dataset of 1.2 million images for half a million buildings.
This open‐source framework enhances the scope, adaptability, and granularity of building‐level assessments, enabling more fine‐grained and interpretable insights into the built environment.
</div>



<!-- ![](/images/blog/10-cupum-bd-caption/framework.jpg) -->
<!-- <figure style="display:flex;flex-direction:column;align-items:center;">
    <img src="/images/blog/10-cupum-bd-caption/framework.jpg" alt="Research framework" style="width:90%;height:auto;">
</figure> -->


<!-- ![](/images/blog/10-cupum-bd-caption/examples_all.jpeg) -->
<!-- <figure style="display:flex;flex-direction:column;align-items:center;">
    <img src="/images/blog/10-cupum-bd-caption/examples_all.jpeg" alt="Building clusters" style="width:90%;height:auto;">
</figure> -->


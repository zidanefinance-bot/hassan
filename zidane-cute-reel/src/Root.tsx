import React from "react";
import { Composition } from "remotion";
import { Main, FPS, TOTAL } from "./Main";
import { Canteen, CANTEEN_TOTAL } from "./videos/Canteen";
import { MessyList, MESSY_TOTAL } from "./videos/MessyList";
import { TeamRation, TEAM_TOTAL } from "./videos/TeamRation";
import { UgcSourcing, UGC_TOTAL } from "./videos/UgcSourcing";
import { PostCompositions } from "./corporate/Posts";
import { BannerCompositions } from "./corporate/Banners";
import { CatalogCompositions } from "./corporate/CatalogPdf";
import { CorpBrands, BRANDS_TOTAL, CorpBiryani, BIRYANI_TOTAL, CorpChai, CHAI_TOTAL, CorpQuestions, QUESTIONS_TOTAL, CorpListQuote, LISTQUOTE_TOTAL } from "./corporate/ProductReels";
import { CorpOldWay, OLDWAY_TOTAL } from "./corporate/OldWay";
import { CorpProcess, PROCESS_TOTAL, CorpIndustries, INDUSTRIES_TOTAL, CorpCategories, CATEGORIES_TOTAL } from "./corporate/Reels";

const size = { fps: FPS, width: 1080, height: 1920 } as const;

export const RemotionRoot: React.FC = () => (
  <>
    <PostCompositions />
    <BannerCompositions />
    <CatalogCompositions />
    <Composition id="CorpBrands" component={CorpBrands} durationInFrames={BRANDS_TOTAL} {...size} />
    <Composition id="CorpBiryani" component={CorpBiryani} durationInFrames={BIRYANI_TOTAL} {...size} />
    <Composition id="CorpChai" component={CorpChai} durationInFrames={CHAI_TOTAL} {...size} />
    <Composition id="CorpQuestions" component={CorpQuestions} durationInFrames={QUESTIONS_TOTAL} {...size} />
    <Composition id="CorpListQuote" component={CorpListQuote} durationInFrames={LISTQUOTE_TOTAL} {...size} />
    <Composition id="CorpOldWay" component={CorpOldWay} durationInFrames={OLDWAY_TOTAL} {...size} />
    <Composition id="CorpProcess" component={CorpProcess} durationInFrames={PROCESS_TOTAL} {...size} />
    <Composition id="CorpIndustries" component={CorpIndustries} durationInFrames={INDUSTRIES_TOTAL} {...size} />
    <Composition id="CorpCategories" component={CorpCategories} durationInFrames={CATEGORIES_TOTAL} {...size} />
    <Composition id="Canteen" component={Canteen} durationInFrames={CANTEEN_TOTAL} {...size} />
    <Composition id="MessyList" component={MessyList} durationInFrames={MESSY_TOTAL} {...size} />
    <Composition id="TeamRation" component={TeamRation} durationInFrames={TEAM_TOTAL} {...size} />
    <Composition id="UgcSourcing" component={UgcSourcing} durationInFrames={UGC_TOTAL} {...size} />
    <Composition id="ZidaneReel" component={Main} durationInFrames={TOTAL} {...size} />
  </>
);

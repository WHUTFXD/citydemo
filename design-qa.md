# Design QA

## Comparison targets

- Source visual truth:
  - `C:\Users\FXD\Desktop\闵行城运demo\现有系统样式\派单列表.png`
  - `C:\Users\FXD\Desktop\闵行城运demo\web-demo\public\assets\true-order-detail-reference.png`
  - `C:\Users\FXD\AppData\Local\Temp\codex-clipboard-04c7e4bd-314d-467b-97bc-9007a530e1d6.png`
  - `C:\Users\FXD\AppData\Local\Temp\codex-clipboard-ea81a520-0499-49aa-8f9e-9dd28336c779.png`
  - `C:\Users\FXD\AppData\Local\Temp\codex-clipboard-eb1302f7-9519-4706-9b5b-adc7c9801410.png`
- Browser-rendered implementation:
  - `http://127.0.0.1:3000/`
  - `http://127.0.0.1:3000/orders/mh-006`
- Implementation screenshot evidence: captured and inspected in the Codex in-app browser at 1440×900 and 1920×1080. The browser tool exposes the captures inline rather than as a persistent filesystem path.
- Source pixels: list 1961×968; corrected detail reference 1407×863.
- Implementation CSS viewports: 1440×900 and 1920×1080; device pixel ratio 1.0.
- State: default pending-verification list; automatic-dispatch running, paused, completed, and manual-intervention states; corrected dispatch-detail page with the low-confidence address bubble open.

## Full-view comparison evidence

- The implementation preserves the source composition: blue platform header, pale sidebar, workspace tab strip, compact pale-blue form panels, and desktop government-system information density.
- The corrected detail page now follows the true order-detail workflow: basic information, attachment handling, event dispatch, and bottom actions.
- The previously reproduced administrator completion-review blocks, including “上步批注” and “办结情况”, have been removed from the detail route.
- Red annotation boxes and arrows are treated as product instructions rather than visible UI. Their requested AI capabilities are implemented as compact inline triggers and floating recommendation bubbles, so the base form remains intact.
- At 1440×900 the application has no horizontal overflow and uses a short vertical scroll for the bottom actions; at 1920×1080 the full dispatch form and action bar fit in one viewport with no overflow.
- The automatic-dispatch control occupies the unused right side of the existing tab row. It does not move the source legend, filters, original cards, or sidebar.
- Completed automatic cards retain the original 144px density. The single low-confidence card remains first while later successful cards continue to arrive below it.

## Focused region comparison evidence

- Header/sidebar: platform emblem, title scale, icon family, menu density, notification badges, and active-item treatment align with the source system.
- Basic information: task/link identifiers, source and business type, complainant and city category, masked phone action, received time, and 12345 stamp follow the supplied layout.
- Dispatch form: case type, urgency, occurrence address, standard address, map-location action, address segmentation, and five-level responsibility-grid selection are present.
- Event dispatch: arrival and processing deadlines, primary/assisting department selection, dispatch opinion, quick replies, multi-event checkbox, and bottom operations match the corrected source structure.
- AI layer: case classification, standardized address, and responsibility grid retain their compact field-level triggers. The entire “事件派单” block now has exactly one `AI推荐` trigger placed beside the section title; its floating panel keeps time independent and exposes three candidates each for primary unit, assisting unit, and dispatch opinion.
- AI-entry consistency: all four `AI推荐` triggers now follow the field or section label they assist and use the same 62×24px size, robot icon, 11px regular label, pale-blue fill, blue border, 2px radius, hover treatment, and focus ring.
- Independent adoption: adopting a result updates only its own module. Time does not alter departments or opinion; primary and assisting units do not alter each other; opinion does not overwrite either unit.
- Map layer: standardized-address candidates open in an AMap modal with three numbered markers and candidate switching. A separate “手动新增点位” mode lets the operator click the AMap surface, drag the new marker for fine adjustment, view longitude and latitude, and adopt the reverse-geocoded standard address without changing the preset candidate JSON.
- Automation controls: the compact switch, phase copy, `n/6` counter, countdown, and replay action remain legible at both desktop widths and reuse the existing blue/gray tokens.
- Automation cards: `AI研判中`, `AI自动派单`, `需人工干预`, address-confidence, and `人工已确认` tags are readable without covering task IDs or linked IDs.
- Manual intervention: the detail route opens with a compact amber explanation strip and the three low-confidence address candidates already visible.

## Required fidelity surfaces

- Fonts and typography: Microsoft YaHei/PingFang SC system stack, 12–13px dense body text, strong identifiers, and compact line heights preserve the legacy government-system character.
- Spacing and layout: the source header/sidebar proportions and section rhythm are maintained at both required desktop sizes.
- Colors and tokens: deep platform blue, pale blue-gray section surfaces, slate copy, red required markers, and blue primary actions are consistently reused.
- Image quality and assets: the supplied reference raster is retained as a local design reference; the existing screenshot-derived platform emblem and 12345 stamp remain temporary assets until official originals are supplied.
- Copy and content: labels follow the corrected screenshot while all work-order values remain fictional and masked.
- Accessibility and behavior: semantic buttons/inputs, keyboard-focusable controls, section expansion states, validation feedback, and reduced-motion handling are present.

## Comparison history

1. Initial pass reproduced the supplied administrator completion-review screen as the order detail.
2. The user clarified that the true detail is a pre-dispatch verification screen and supplied the corrected reference.
3. The detail page was rebuilt around the corrected basic-information, attachment, and event-dispatch structure; completion-review content was removed.
4. A restrained AI layer was added using the same blue, border, typography, and spacing tokens as the legacy page; no permanent recommendation panel consumes form space.
5. A P1 overlay issue was found during interaction QA: the address recommendation popover initially remained above the map modal. The popover now closes before the modal opens, and the corrected state was visually rechecked.
6. A development hydration mismatch caused by rendering the map portal before its client container existed was fixed by initializing AMap from a mounted callback ref.
7. Post-fix browser captures at 1440×900 and 1920×1080 confirmed the corrected hierarchy, dense field alignment, readable recommendation bubbles, and absence of horizontal overflow.
8. The first automatic-dispatch visual pass accidentally changed absolute card controls into normal grid items, increasing each card from 144px to roughly 230px (P1 density regression). The broad stacking selector was removed; post-fix measurements returned every automatic card to 144px at both desktop viewports.
9. The completed summary initially truncated its final clause at 1440px (P2 copy visibility). The post-resolution copy was shortened to `自动派单 5 条，人工确认 1 条`; the full message is now visible without enlarging the tab row.
10. The event-dispatch AI controls were consolidated from separate time and primary-unit bubbles into one shared popup. Four tabs and four summary counters make the requested `3+3+3+3` structure explicit while preserving the source form layout.
11. The missing assisting-unit recommendation set was added to the local fixture. Browser testing confirmed that adopting the second assisting-unit result fills `区级部门 / 闵行区交通委员会` without changing the primary unit or opinion.
12. A manual AMap point was added and adopted as `东川路地铁站2号口人工确认点`; the selected coordinates appeared immediately and the standard-address field was updated after adoption.
13. The first unified-popup pass repeated the same four groups in both a summary-card row and the tab row (P2 information redundancy). The summary row was removed, leaving one clear set of four tabs.
14. The first unified-popup pass required manual tab changes after every adoption (P2 workflow friction). Adoption now advances from time → primary → assisting → opinion, completed tabs gain a green check, and the final group remains visible for review.
15. The event-dispatch AI entry was moved from the deadline row to the “事件派单” section title so it reads as one block-level recommendation entry and no longer interrupts the original field alignment.
16. Responsibility evidence was upgraded from static copy to inspectable history-order and rule-file entries. Both detail dialogs expose source, metadata, and the relevant handling or rule text.
17. Primary, assisting, and opinion recommendations now form an explicit `3×3×3` path after the independent deadline step. The assisting set contains exactly three eligible choices, excludes the selected primary unit, and includes “无需协办单位”.
18. The follow-up screenshot exposed a P2 consistency problem: AI triggers were distributed across field ends, label middles, and the event-section title, while the dispatch trigger had extra visual weight. All triggers were normalized to one token set and aligned to the same right-side vertical guide. Post-fix measurements at 1440×900 confirmed identical 62×24px bounds, font size/weight, colors, border, radius, and right offset for all four controls.
19. The user preferred the controls on the left to match the reading and action sequence. The right-side rail was replaced with one semantic placement rule: field/section label → `AI推荐` → current value or form content. Browser QA at 1440×900 confirmed the two short field labels share the same button origin, the long responsibility label and event title keep the same immediate-following relationship, and no horizontal overflow was introduced.

## Interactions tested

- List-to-detail navigation and return.
- Detail section collapse and expand.
- Case type, urgency, address, grid, primary department, and assisting department controls.
- Quick-reply insertion into the dispatch opinion.
- The three field-level AI entries plus the single event-dispatch AI entry, top-three ranking display, evidence expansion where applicable, and one-click adoption.
- Four independent event-dispatch recommendation groups, each with three visible presets and persistent per-group adopted state while the popup remains open.
- Sequential adoption through all four groups: each adoption advanced exactly one tab, the footer progressed from `0/4` to `4/4`, and completed tabs remained available for revision.
- Adopting the first primary recommendation produced exactly three assisting candidates: two non-matching departments and “无需协办单位”; adopting the empty option cleared both assisting fields and advanced to dispatch opinion.
- The manual assisting-department selector excluded the currently selected primary department and allowed both assisting controls to remain empty.
- The first responsibility recommendation exposed two historical work orders and one rule file. Both the historical-order and rule-file detail dialogs were opened and their source, metadata, and content were verified.
- Time, primary unit, assisting unit, and dispatch opinion were adopted in sequence. Browser state confirmed that every adoption updated only its own controls.
- AMap modal opening from both the standardized-address bubble and the GIS/map-location controls; marker display, candidate switching, manual mode, click-to-add coordinates, reverse-geocoded standard-address display, editable fallback address, and final standard-address adoption.
- Required-field validation and successful dispatch confirmation feedback.
- Upload and simulated map, multimedia comparison, outbound-call, bilateral-contact, and operation-switch feedback.
- Browser console rechecked after the final reload at both desktop sizes; the live page produced no warnings or errors.
- The unified trigger set was rechecked at 1440×900: every trigger had a 62×24px bounding box and identical visual tokens; `scrollWidth` equaled `clientWidth` (1425px) and the browser reported no warnings or errors.
- At 1440×900, document `scrollWidth` equaled `clientWidth` and the event-dispatch section contained exactly one AI trigger. The floating panel stayed fully within the viewport.
- At 1920×1080, document `scrollWidth` again equaled `clientWidth`; no horizontal overflow was introduced.
- Production lint, TypeScript, and build checks passed.
- Full 31-second sequence: five automatic successes, one low-confidence manual exception, and no blocked subsequent arrivals.
- Pause before first arrival, four-second paused hold, resume from the remaining countdown, and replay reset.
- Exception pinning while the fourth through sixth orders arrive, with order IDs verified as `auto-003`, `auto-006`, `auto-005`, `auto-004`, `auto-002`, `auto-001` before manual resolution.
- Navigation to the exception detail while the global timeline continued, address confirmation guard, recommended-address adoption, final confirmation, return to the list, unpinning, and `人工已确认` state.

## Demo data boundary

- Every AI result, confidence score, rationale, evidence item, similar case, coordinate, time limit, primary unit, assisting unit, and dispatch opinion is read from `src/data/ai-recommendations.json` or `src/data/auto-dispatch-scenario.json`.
- Manually added map points exist only in local page state and are explicitly presented as operator input, not as AI output.
- All six automatic-dispatch orders, arrival offsets, analysis durations, outcomes, confidence values, departments, and the manual exception's three address candidates are scenario JSON fixtures.
- The demo makes no request to an AI model or AI service. AMap is used only to render the address-candidate map when map credentials are configured.

## Follow-up polish

- P3: security watermarks and the red annotation overlay were intentionally not reproduced because neither is part of the application UI.
- P3: the official source logo can replace the screenshot-derived emblem when the original asset is supplied.

final result: passed

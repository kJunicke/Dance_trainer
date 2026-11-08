# Within-Session Practice Structure for the Dance Trainer

*A primary-source research brief on how to structure the inside of one practice session — how long to stay on a figure, how many repetitions, when to switch, whether to come back — written as a companion to `motorLearningForDance.md`. Between-session spacing (days, expanding intervals, decay curves) is deliberately out of scope; see `spacedRepetitionForMotorLearning.md`.*

---

## Scope & method

Same conventions as the parent brief: every load-bearing claim is traced to the paper that owns it, read via the journal page, PubMed/Europe PMC, the publisher's DOI, or an open-access author copy. Where the parent brief already covers a source, this file points to it by section number rather than repeating it.

**Evidence labels used inline:**

- **PRIMARY** — traces to the original study / researcher's own writing.
- **RCT-BACKED** — supported by randomised controlled experiment(s).
- **META-BACKED** — supported by a meta-analysis or systematic review.
- **THEORY-DERIVED** — a framework/model, not a single decisive experiment.
- **CONTESTED** — genuine, active scientific disagreement or partial replication.
- **SPECULATIVE** — my extrapolation to dance / to the app; treat as a hypothesis to test.
- **(unverified)** — I could not confirm it from a solid source.

**What was verified how.** Title / authors / journal / volume / pages were confirmed against the journal page, Europe PMC, OpenAlex or Crossref for every citation marked **VERIFIED** in the Sources section. Abstracts were read verbatim for: Brawn 2010, Rickard 2008, Gupta & Rickard 2022, Savion-Lemieux & Penhune 2005, Goedert & Miller 2008, Lee & Genovese 1989, Keetch & Lee 2007, Wu & Magill 2011, Keetch et al. 2005/2008, Breslin et al. 2012, Porter et al. 2020, Branscheidt 2019, Bertollo 2010, Fauntroy 2023, Czyż 2024 (both), Ammar 2024. Full text was read for Carter & Grahn 2016 and Bönstrup 2019. For Driskell 1992, Duke et al. 2009, Maynard 2006, Guadagnoli et al. 1999, Hebert et al. 1996 and Ammar 2023 the bibliographic record is verified but the numbers come from secondary summaries and are marked **(unverified)** where used. Newell & Rosenbloom 1981 is a book chapter I did not retrieve.

**A caveat that colours this whole file:** the questions the app actually needs answered — *how many reps on one card, then what?* — have **no clean experimental answer**. The literature gives (a) a shape (diminishing returns per rep, within-bout fatigue), (b) a set of *ordering* effects (blocked vs random) that are real in the lab and small in applied settings, and (c) a handful of *contingent switching* studies that are the closest thing to a rule the app can implement. Everything in §6 that turns those into a number is labelled SPECULATIVE and should be treated as an engineering default, not a finding.

---

## TL;DR — ranked by leverage for the app

1. **There is no evidence-based rep count. Stop looking for one.** Amount of practice within a session *per se* did not predict 4-week retention of a motor sequence (Savion-Lemieux & Penhune 2005); total practice time and total trials did not predict next-day retention in advanced pianists (Duke, Simmons & Cash 2009); extra within-session problems bought nothing at 1–4 weeks in maths (Rohrer & Taylor 2006). The dose that matters is *distribution*, which is the other file's job. **PRIMARY / RCT-BACKED.**

2. **What predicts retention is what happens *around* an error, not how many times you repeat.** The three behaviours shared by the best-retaining pianists: locate the *precise* source of each error, vary tempo systematically, and repeat a target passage *until it is corrected and stable* — then stop. Fewer wrong attempts, not more right ones. **PRIMARY** (Duke et al. 2009, observational, n = 17).

3. **Returns per rep diminish exponentially, and continuous bouts accrue reactive inhibition.** The law of practice is exponential, not power (Heathcote, Brown & Mewhort 2000): each rep buys a fixed fraction of the *remaining* improvement. On top of that, performance *within* a massed bout degrades and recovers with a short rest (Rickard et al. 2008; Brawn et al. 2010; Gupta & Rickard 2022; Bönstrup et al. 2019 — same data, contested interpretation). Practical upshot: **short visits with breaks, not long grinds.** **PRIMARY / CONTESTED mechanism.**

4. **Interleaving for motor skills: real, small in the real world, ~zero for young learners, and a sequence is safest.** Four meta-analyses (Brady 2004; Ammar 2023/2024; Czyż 2024 ×2) disagree loudly in their headlines but *converge* on the numbers: lab retention effect ≈ 0.6–0.9 SD; applied/sport ≈ 0.2 (non-significant); under-18s ≈ 0. Systematically **increasing** interference (blocked → serial → random) beat both pure schedules in the one direct test (Porter & Magill 2010). **META-BACKED / CONTESTED.**

5. **"Win-shift / lose-stay" is the closest thing to an implementable rule, and the criterion matters.** Switching after **one** success produced random-like retention; requiring **two consecutive** successes produced blocked-like retention (Simon, Lee & Cullen 2008). In a complex sport skill, though, the win-shift group improved *transfer* only and plain blocked practice won on retention (Porter et al. 2020). **PRIMARY / RCT-BACKED, mixed.**

6. **For discrete skills, tight within-visit repetition (short gaps between reps) is not harmful — it was *better* in the one clean test.** Lee & Genovese (1989) found massed practice *helped* a discrete timing task while it hurt the continuous version. A dance figure is closer to discrete than to continuous tracking. So: reps *inside* a visit can be tight; the break belongs *between* visits. **PRIMARY / RCT-BACKED (single lab study).**

7. **Repeating the exact competition version has its own value — "especial skills".** Massive practice at one exact instance produces an advantage specific to that instance (Keetch et al. 2005), and even 300 constant-practice trials in novices reproduces it (Breslin et al. 2012). Variable practice buys transfer; constant practice buys the thing you will actually perform. Both are real; pick per card. **PRIMARY.**

8. **Do not practise into muscle fatigue.** Training to fatigue impaired acquisition on *subsequent, unfatigued* days (Branscheidt et al. 2019). Dance-medicine injury data point the same way (Liederbach & Compagno 2001). This is the only session-length finding with teeth; nothing supports a specific minute count. **PRIMARY.**

9. **Learners left to choose their own switching do at least as well as any imposed schedule** (Keetch & Lee 2007; Wu & Magill 2011) — but this sits inside the self-controlled literature the parent brief (§2) flags as underpowered. Offer the choice; don't bank on it. **CONTESTED.**

---

## §0 "Don't grind one thing for an hour" — is it true for movement?

**Verdict, in three parts.**

**(a) The *anti-grind* half is well supported, but for a different reason than the learning-science slogan implies.** The reason not to drill one figure for an hour is not primarily that interleaving is magic; it is that (i) returns per rep fall off exponentially (§1.1), (ii) a continuous bout accrues reactive inhibition that masks whatever has been learned and that a short rest removes (§1.3), (iii) practising into fatigue damages *later* learning (§5), and (iv) once the passage is corrected and stable, extra correct reps add nothing measurable to retention (§1.2). Every one of those is a diminishing-returns / cost-accrual argument, and every one says **stop earlier than feels natural** — with or without switching to something else.

**(b) The *alternate-instead* half is real in the lab, weak in the gym, and close to zero for the young learner.** The contextual-interference effect exists (Shea & Morgan 1979; parent §3) and the best current pooled lab estimate is a retention SMD around 0.6–0.9 (Czyż et al. 2024). But the same meta-analysis puts the *applied* estimate at 0.23 with a confidence interval crossing zero; Brady (2004) had 0.19; Ammar et al. (2023) found only 20% of 183 sport/PE outcomes going the predicted way; and under-18s show ≈ 0 in Czyż's model. Skill-level moderators run the same direction: novices learned *more* under blocked practice in tennis (Hebert et al. 1996) and golf (Guadagnoli et al. 1999). The one dance study (Bertollo et al. 2010, rhythmic step sequences) found blocked better after training and *no difference* at 21 days. So "always alternate" is not what the motor evidence says. What survives is a narrower claim: **once a figure is roughly stable, spreading its reps out among other figures costs some session performance and buys a modest amount of retention/transfer, more so for adults and more so when the figures are genuinely different movements.**

**(c) For whom.** Adult, past-novice, on figures that are distinct motor programs: interleave, ideally by ramping (blocked → serial → random). Novice, or a brand-new figure, or a learner under 18: block first, and the honest expectation is that ordering effects will be small either way. For *anyone*, the stronger lever is the stopping rule *within* a visit (§1, §6), not the order of visits.

---

## §1 How many repetitions / how long on one skill before switching?

### 1.1 The shape: diminishing returns per rep

**Finding.** Improvement per repetition falls off steeply. The "power law of practice" (Newell & Rosenbloom 1981 — **PRIMARY, chapter not retrieved**) was the standard description; Heathcote, Brown & Mewhort (2000) re-fit 40 datasets (7,910 individual learning series, 475 participants, 24 experiments) and found the **exponential** fit better than the power function in *every* unaveraged dataset — the power-law appearance was an averaging artefact. **PRIMARY / VERIFIED.**

**Why it matters for a stopping rule.** An exponential law means each rep removes a roughly constant *proportion* of the remaining gap to asymptote — the gains are front-loaded and the approach to plateau is faster than a power law would suggest. There is no elbow to detect; the curve just keeps flattening. This is the formal reason "a few more reps" has decreasing value and why any rep cap is a judgement, not a threshold the data hands you.

### 1.2 Overlearning: does continuing past first success buy retention?

**Evidence.**
- **Driskell, Willis & Copper (1992),** *Journal of Applied Psychology* 77:615–622 — **VERIFIED citation.** Meta-analysis of overlearning; moderate overall effect on retention (d ≈ 0.75 for cognitive tasks per secondary summaries — **(unverified number)**); the effect was *smaller for physical tasks than cognitive tasks* and *weakened as the retention interval lengthened* **(unverified specifics — abstract not retrievable)**. **META-BACKED.**
- **Rohrer, Taylor, Pashler, Wixted & Cepeda (2005),** *Applied Cognitive Psychology* 19(3):361–374 — **VERIFIED.** 218 students, geography facts / word definitions. Overlearners recalled far more at 1 week; the advantage "decreased dramatically thereafter." Overlearning judged "an inefficient strategy." **PRIMARY / RCT-BACKED (verbal).**
- **Rohrer & Taylor (2006),** *Applied Cognitive Psychology* 20:1209–1224 — **VERIFIED.** Maths procedure: 3 vs 9 practice problems in one session — the extra six had **no effect** at 1 or 4 weeks; distributing 10 problems over two sessions nearly **doubled** the 4-week score. **PRIMARY / RCT-BACKED (maths).**
- **Motor analogue — Savion-Lemieux & Penhune (2005),** *Experimental Brain Research* 161:423–431 — **VERIFIED.** Timed 10-element tapping sequence; 1, 3 or 6 blocks of practice then a 4-week recall. "Amount of practice per se did not affect learning and retention of the task. Rather, distribution of practice over several days was the most important factor." **PRIMARY / RCT-BACKED (motor).**
- **Motor analogue — Goedert & Miller (2008),** *Experimental Brain Research* 189:189–197 — **VERIFIED.** Mirror tracing; 1, 3 or 7 trials before a 24-h break, then the rest. Groups that broke after 1 or 3 trials showed offline gains; the 7-trial group did not, and ended *lower* despite equal total trials. **PRIMARY / RCT-BACKED.** (A within-day "too many in one go" signal — see §5.)
- **Dose–response in children — Ghanamah, Eghbaria-Ghanamah, Karni & Adi-Japha (2020),** *Learning and Instruction* 69:101351 — **VERIFIED citation.** 7–8-year-olds, invented-letter grapho-motor task, 6 / 12 / 24 blocks in one session. Limited practice: good within-session learning, no lasting benefit. Extended practice: best within-session gain. **Intermediate dose (or 4 short daily sessions): best retention.** Title says it: "too little, too much." **PRIMARY / RCT-BACKED (children, fine-motor).**

**Caveats.** The verbal/maths overlearning results transfer to dance only by analogy (**THEORY-DERIVED**). Driskell's physical-task subset is the direct evidence and it is the weaker half. The motor studies above are lab sequence tasks with adults or children, not whole-body skills. None gives a number that survives contact with a different task.

**Coaching translation.** *Reaching* a clean execution is the point of a visit; *stacking* many clean executions on top has small, fast-decaying value inside a session. The bank you draw on next week is filled by coming back on another day, not by rep 15 today.

### 1.3 Reactive inhibition: why the end of a bout looks worse than it is

**Finding.** Performance within a massed practice bout degrades from causes that are *not* forgetting — task-related inhibition / fatigue — and recovers after a short rest. Averaged learning curves hide this.

**Evidence.**
- **Rickard, Cai, Rieth, Jones & Ard (2008),** *JEP: Learning, Memory & Cognition* 34(4):834–842 — **VERIFIED, abstract read.** Identified four artefacts behind the "sleep enhances motor learning" claim, including "masking of reactive inhibition effects in the averaged training data" and "a gradual buildup of fatigue over the course of massed training." When controlled, the sleep enhancement vanished. Pan & Rickard 2015 continues this (parent §3). **PRIMARY.**
- **Brawn, Fenn, Nusbaum & Margoliash (2010),** *Journal of Neuroscience* 30(42):13977–13982 — **VERIFIED, abstract read.** Same finger-sequence task: "when training begins in the morning, motor-sequence performance *deteriorates across wakefulness* and recovers after sleep, whereas performance remains stable across both sleep and subsequent waking with evening training." They still argue for a sleep role; the point for us is the documented **within-day deterioration after a morning session**. **PRIMARY / CONTESTED interpretation.**
- **Gupta & Rickard (2022),** *npj Science of Learning* 7:25 — **VERIFIED, abstract read.** N = 159; massed (30 s per trial) vs spaced (10 s) tapping, breaks of 10 s or 30 s, then a 300-s rest and test. "The smaller the ratio of break time to on-task trial time during training, the larger the improvement in reaction time after the rest period" — fully fit by a model with **no offline consolidation**, only learning concurrent with performance plus inhibition that builds during work and dissipates during breaks. **PRIMARY / RCT-BACKED.**
- **Bönstrup, Iturrate, Robertson et al. (2019),** *Current Biology* 29(8):1346–1351 — **VERIFIED, full text read.** 36 trials of 10 s practice / 10 s rest. Performance change *during* practice periods ≈ −0.32 keypresses/s; gains *during the 10-s rests* ≈ 2.69 keypresses/s, "approximately 95% of overall Day 1 learning," and four times the overnight gain (0.73). They call it "micro-offline consolidation." Gupta & Rickard's model reproduces the same pattern without consolidation. **PRIMARY / CONTESTED mechanism.**

**Caveats.** All four use finger-tapping. The *mechanism* fight (rapid consolidation vs dissipating inhibition) is unresolved and does not need to be resolved for design: **both accounts predict that the last reps of a long bout underestimate what was learned, and that a short pause restores it.** A dancer who "gets worse" on rep 12 has probably not unlearned anything.

**Coaching translation.** Judge a figure on its *first few* reps after a pause, not its last few before one. Deterioration late in a bout is a signal to rest or switch, not to push.

### 1.4 Music-pedagogy evidence on repetitions per passage

- **Duke, Simmons & Cash (2009),** *Journal of Research in Music Education* 56(4):310–321 — **VERIFIED citation.** 17 advanced pianists practised a 3-bar Shostakovich passage until confident, tested next day. **No relationship** between retention rank and practice time (range 8.5–57 min — **(unverified range)**), total trials, or complete trials. The three strategies shared by the top-ranked and rare elsewhere: (1) the *precise* location and source of each error was identified, rehearsed and corrected; (2) tempo was varied systematically (slowing into hard spots); (3) the target passage was **repeated until the error was corrected and the passage stabilised** — and then they moved on. Secondary summaries add that the top eight averaged ~3 incorrect attempts vs ~13.6 for the bottom nine **(unverified numbers)**. **PRIMARY (observational, n = 17).**
- **Maynard (2006),** *Bulletin of the Council for Research in Music Education* 167:61–72 — "The role of repetition in the practice sessions of artist teachers and their students." **VERIFIED citation only; contents (unverified).**
- **Stambaugh (2011),** *JRME* 58(4):368–383 — **VERIFIED.** 41 beginning clarinettists, three 7-note exercises, 3 sessions: blocked = 18 trials of one exercise per day; random = 6 × 3 exercises. No acquisition differences; at retention the random group was **faster** only, no other differences. **PRIMARY / RCT-BACKED (applied, beginners) — weak CI effect.**
- **Carter & Grahn (2016),** *Frontiers in Psychology* 7:1251 — **VERIFIED, full text read.** 10 advanced clarinettists, within-subject: 12 min blocked per piece vs 3-min alternating segments. Where raters differed, interleaved pieces rated better, but two of three raters saw no difference and inter-rater correlations were 0.02–0.59. Participants **found interleaving more useful yet preferred blocked** — the fluency illusion. **PRIMARY (small, applied).**
- **Mathias & Goldman (2024/2025),** *JRME* 72(4):357–375 — **VERIFIED citation.** 20 advanced violinists; blocked vs *increasing* CI (blocked-then-random) vs random; no acquisition differences; the random schedule was most effective at 24-h retention (per the indexed abstract — **(unverified which condition; wording ambiguous)**); half the participants believed blocked was best. **PRIMARY.**

**What music adds.** The only *dose* finding is negative (Duke: volume does not predict retention). The only *positive* signal is a **behavioural stopping criterion**: repeat *until corrected and stable*, then stop. That is a rule the app can implement (§6).

### 1.5 Honest answer to Q1

**No clean number exists.** The evidence supports a *shape* (front-loaded gains, inhibition accruing) and a *criterion* (stop when corrected and stable; don't push into deterioration or fatigue), not a count. Anything like "5 reps" or "3 minutes" is an engineering default.

---

## §2 Interleaving, critically

### 2.1 The lab effect and its proposed moderator

- **Shea & Morgan (1979)** — parent §3. **PRIMARY.**
- **Magill & Hall (1990),** *Human Movement Science* 9:241–289 — **VERIFIED.** The field's canonical review. Proposed that the CI effect appears when the practised variations are governed by **different generalised motor programs (GMPs)** and is weak or absent when they differ only in **parameters** (speed, amplitude, force) of the same program. **THEORY-DERIVED.**
- **Lee, Wulf & Schmidt (1992),** *Quarterly Journal of Experimental Psychology* 44A(4):627–644 — **VERIFIED.** Consistent with Magill & Hall: CI usually *not* found for parameter-only variations; different relative-timing structures were a prerequisite for random > blocked. **PRIMARY / RCT-BACKED.**
- **But — Wulf & Lee (1993),** *Journal of Motor Behavior* 25(4) — **VERIFIED citation.** Found the *opposite* pattern: a CI effect for parameter learning and none for GMP learning. So the GMP moderator is **CONTESTED**, not settled. The safe reading for dance: interleaving figures that are *genuinely different movements* is the case most consistently supported; interleaving *sizes/tempos of the same figure* has mixed support.

**Mechanisms (both still live).**
- **Forgetting–reconstruction — Lee & Magill (1983),** *JEP: LMC* 9:730–746 — **VERIFIED.** Switching tasks makes you *forget* the action plan, so each return forces re-construction; the reconstruction is the learning. Predicts: a visit that starts cold is worth more than a rep that continues warm.
- **Elaboration — Shea & Zimny (1983),** in Magill (Ed.), *Memory and Control of Action* — **VERIFIED citation.** Random order forces inter-task comparison, giving each task a more distinctive, elaborated representation.
- **Neurophysiological consolidation — Wright, Verwey, Buchanan, Chen, Rhee & Immink (2016),** *Psychonomic Bulletin & Review* 23(1):1–21 — **VERIFIED.** Integrates both: under high CI, dorsal premotor cortex and the SMA complex are recruited *earlier and more extensively* during sequence planning; the extra planning demand each trial is what pays off later. **THEORY-DERIVED / PRIMARY review.**

### 2.2 Meta-analyses — the numbers converge even where the abstracts fight

| Source | Scope | Retention effect (high vs low CI) | Applied / sport | Youth |
|---|---|---|---|---|
| **Brady (2004)**, *Perceptual & Motor Skills* 99:116–126 — **VERIFIED** | 61 studies, 139 ES | overall 0.38; **lab 0.57** | **0.19** | adults 0.50 vs young 0.10 |
| **Barreiros, Figueiredo & Godinho (2007)** — parent §3 | 27 applied studies | positive retention effect in 11/27 | — | — |
| **Ammar, Trabelsi, Boujelbane, Boukhris, Glenn, Chtourou & Schöllhorn (2023)**, *Educational Research Review* 39:100537 — **VERIFIED citation** | 36 sport/PE studies, 183 outcomes | only **37/183 (20%)** outcomes matched the CI prediction; "little evidence" | (this *is* the applied set) | — |
| **Ammar et al. (2024)**, *Educational Psychology Review* 36(2), doi 10.1007/s10648-024-09892-z — **VERIFIED** | same corpus, multilevel model | acquisition ≈ equal (ES ≈ 0.1); retention **modest** favouring high CI (ES ≈ 0.35 in magnitude); "very limited evidence" for PE | — | age a significant moderator |
| **Czyż, Wójcik, Solarská & Kiper (2024)**, *Scientific Reports* 14:15974 — **VERIFIED, results read** | 54 studies, lab + applied | **0.63** (0.33–0.93); 0.43 after outlier removal | **lab 0.92 vs applied 0.23** (−0.16–0.62, p = .24) | **<18 y: 0.02** (ns); adults 0.63; ≥60 y 1.45 |
| **Czyż, Wójcik & Solarská (2024)**, *Frontiers in Psychology* 15:1377122 — **VERIFIED, results read** | 34 studies, *transfer* | **0.55** (0.25–0.86) | lab 0.75 vs applied 0.37 (p = .06) | <18 y: 0.12 (ns) |

**The dispute.** Ammar & Schöllhorn (SportRxiv comment, 2024) object to Czyż et al.'s "robust phenomenon" conclusion and their dismissal of the 2023 review; Czyż rebutted (SportRxiv 437) and published a commentary in *Educational Psychology Review* 37(2), 2025 (doi 10.1007/s10648-025-10006-6); a further *EPR* paper, "Advancing Contextual Interference…" (2025, doi 10.1007/s10648-025-10043-1, authorship **(unverified)**), continues it. **CONTESTED.**

**What is *not* in dispute:** the *applied* effect is ≈ 0.2 across Brady, Czyż and (by their 20% count) Ammar; the *youth* effect is ≈ 0; and the lab effect is real and medium-to-large. For an app used by adult amateurs learning real dance figures, the honest prior is **a small positive effect with a confidence interval that includes zero**.

### 2.3 Moderators: skill level and task complexity

- **Hebert, Landin & Solmon (1996),** *RQES* 67(1):52–58 — **VERIFIED citation.** Tennis groundstrokes: no difference for high-skilled; **blocked better for low-skilled**. **PRIMARY / RCT-BACKED (applied).**
- **Guadagnoli, Holcomb & Weber (1999),** *J. Human Movement Studies* 37:19–36 — **VERIFIED citation.** Golf putting: **novices learned more under blocked**; experienced players benefited from random. **PRIMARY / RCT-BACKED.**
- **Wulf & Shea (2002),** *Psychonomic Bulletin & Review* 9(2):185–211 — **VERIFIED.** "Principles derived from the study of simple skills do not generalize to complex skill learning." Their synthesis: low-load situations benefit from conditions that *add* challenge (CI, reduced feedback); **very high-load situations benefit from conditions that reduce load.** This is the Challenge Point logic (parent §4) applied to scheduling. **THEORY-DERIVED / review.**
- **Porter & Magill (2010),** *Journal of Sports Sciences* 28(12):1277–1285 — **VERIFIED.** Novices; **systematically increasing CI** (blocked → serial → random across practice) beat both blocked and random on retention for golf putting (same GMP, Exp 1) and on retention *and* transfer for three basketball passes (different GMPs, Exp 2). **PRIMARY / RCT-BACKED (applied).** The single best-supported *schedule* for novices learning sport skills.
- **Dance — Bertollo, Berchicci, Carraro, Comani & Robazza (2010),** *Perceptual & Motor Skills* 110(1):77–84 — **VERIFIED, abstract read.** 40 adolescent females (M = 15.8 y), rhythmic footstep sequences, 6 sessions, retention at 21 days. Blocked > random after training; **no group difference at 21 days**; random held steady, blocked decayed to meet it. Authors: "learning of rhythmic footstep dance sequences was not influenced by practice organization." **PRIMARY / RCT-BACKED (dance, youth) — null.** Consistent with the youth ≈ 0 estimate.

### 2.4 Schedules beyond blocked/random — and what "when to switch" evidence exists

- **Serial** (fixed rotation ABCABC) sits between blocked and random and is the middle rung of Porter & Magill's ramp.
- **Blocked-then-random** — Porter & Magill 2010 (above); Mathias & Goldman 2024 (music, no acquisition difference; retention favoured random **(unverified which)**).
- **Win-shift / lose-stay — Simon, Lee & Cullen (2008),** *Perceptual & Motor Skills* 107(2):407–418 — **VERIFIED.** 48 learners, three multi-segment timing movements. Four groups: blocked, random, **WSLS1** (switch task after *one* trial within 5% of target; otherwise stay), **WSLS2** (switch only after *two consecutive* hits). Acquisition: blocked most accurate; WSLS2 as poor as random; WSLS1 in between. **Next-day retention: random > blocked; WSLS1 ≈ random; WSLS2 ≈ blocked.** Interpretation: a *lenient* success criterion makes the schedule behave like random (frequent switching, more reconstruction); a *strict* one makes it behave like blocked (long stays). **PRIMARY / RCT-BACKED (lab).**
- **Learner-adapted (win-shift) in a complex sport skill — Porter, Greenwood, Panchuk & Pepping (2020),** *European Journal of Sport Science* 20(1):61–71 — **VERIFIED, abstract read.** 36 unskilled adults, 360 basketball set shots from multiple locations over 6 sessions; the learner-adapted group switched location *only after a made shot*. Results: learner-adapted improved **transfer** (d = 1.02) but not retention significantly; **blocked** improved immediate retention (d = 1.83), delayed retention (1.69) *and* transfer (1.39); random improved retention (1.03 / 0.81) only. So in a real, hard, whole-body skill with novices, **plain blocked practice won** and win-shift bought adaptability at the cost of practice success. **PRIMARY / RCT-BACKED (applied).**
- **Self-regulated switching — Keetch & Lee (2007),** *RQES* 78(5):476–486 — **VERIFIED, abstract read.** Cursor patterns, easy vs hard; blocked, random, self-regulated, yoked. Self-regulation gave no acquisition benefit but "the most improved performance in retention, irrespective of task difficulty," and — important — "individual switch strategies … were quite variable" yet the benefit was similar. **PRIMARY / RCT-BACKED.**
- **Wu & Magill (2011),** *RQES* 82(3):449–457 — **VERIFIED, abstract read.** 30 participants, keystroke pattern with three relative-timing structures, 90 trials; self-control group chose the structure before each trial; yoked group followed the same sequence. Self-control had lower relative-timing, absolute and total error on a 24-h serial transfer test. **PRIMARY / RCT-BACKED.** How the self-controllers actually switched (blocked-like early, random-like late is the usual report) is in the body text I did not retrieve — **(unverified)**.

**Caveats on the switching studies.** Simon et al. and Keetch & Lee are simple lab tasks with n ≈ 12/group. Porter et al. 2020 is the only complex-skill test and it favoured blocked. The self-control results live inside the literature McKay et al. (2022) and St. Germain et al. (2022) showed to be underpowered and biased (parent §2) — the *yoked* comparison is exactly the design they criticise. Treat "let the dancer choose" as harmless-and-plausible, not proven.

**What the switching evidence actually says for an app.** (1) A switch-after-success rule is *implementable* and, with a lenient criterion, behaves like random practice in the lab. (2) Make the criterion stricter and you have quietly rebuilt blocked practice. (3) For a hard whole-body skill in novices, the blocked control was the best group in the one direct test — so the rule should be *skill-level-gated*. (4) Whatever the imposed rule, giving the learner an override does not hurt.

---

## §3 Return to a skill later in the same session vs. once per session

**Finding.** There is **no literature that directly manipulates "number of visits per skill per session" holding reps constant.** The closest evidence is (a) the distribution-of-practice work on inter-trial intervals, and (b) the CI literature itself — random practice *is* "many short visits," blocked *is* "one long visit," so §2's numbers are the best available estimate of the value of revisiting.

**Evidence.**
- **Lee & Genovese (1988),** *RQES* 59(4):277–287 — **VERIFIED.** Review of 47 articles on within-session distribution. Massed practice (short inter-trial intervals) depresses performance, and depresses *learning* when measured by absolute retention (secondary summaries cite d ≈ 0.96 for acquisition — **(unverified number)**). But the corpus is dominated by **continuous** tracking/pursuit tasks. **META-BACKED (continuous tasks).**
- **Lee & Genovese (1989),** *RQES* 60(1):59–65 — **VERIFIED, abstract read.** Same movement-timing task built as a *discrete* version (one estimate per trial) and a *continuous* version (20 successive estimates); inter-trial interval 0.5 s (massed) vs 25 s (distributed). "Distributed practice enhanced continuous task performance, whereas **massed practice benefited discrete task acquisition and retention**." **PRIMARY / RCT-BACKED (single study).** A dance figure — a bounded action with a start and an end — is far closer to the discrete case. So inside a visit, reps can be tight.
- **Within-day second session — Shea, Lai, Black & Park (2000),** *Human Movement Science* 19(5):737–760 — **VERIFIED citation.** Two sessions of a balance task separated by **20 min vs 24 h**: the 24-h group was better in the second session and at delayed retention. The within-day revisit was clearly worse than a next-day one, though not compared with no revisit. **PRIMARY / RCT-BACKED.** (Belongs mainly to the other file; cited here only as the one direct within-day-vs-across-day comparison.)
- **Micro-rests between bouts** — Bönstrup 2019 / Gupta & Rickard 2022 (§1.3): the *gap* between bouts is where the visible gain shows up, whichever mechanism you believe. **PRIMARY / CONTESTED mechanism.**
- **Reconstruction hypothesis** (Lee & Magill 1983, §2.1): the theory that gives *revisiting* its value — coming back cold forces plan reconstruction. **THEORY-DERIVED.**

**Caveats.** Nothing here isolates "two visits of 5 reps" from "one visit of 10 reps" in a whole-body skill. The applied CI estimate (≈ 0.2) is the ceiling on what a second visit within the session is likely to be worth, and for youth it is ≈ 0. The within-visit rest question (Lee & Genovese 1989) is one lab study.

**Coaching translation.** *Inside* a visit, run the reps close together — the interval buys nothing for a discrete figure and may cost. *Between* visits, put a real gap and other figures. A second visit to the same figure later in the session is plausibly worth a little (a cold-start rep is a reconstruction rep) but is not evidence-mandated; a second visit *tomorrow* is worth far more.

---

## §4 Variability of practice within a visit

**Finding.** Two truths in tension. Varying the figure (tempo, size, entry) is the schema-theory route to transfer — but its evidence base was thin on critical review; and repeating the *exact* competition version produces an instance-specific advantage that variable practice does not.

**Evidence.**
- **Schema theory / variable practice — Schmidt (1975)** — parent §3. **THEORY-DERIVED.**
- **Van Rossum (1990),** *Human Movement Science* 9:387–435 — **VERIFIED.** "Schmidt's schema theory: the empirical base of the variability of practice hypothesis: a critical analysis." Reviewed 63 studies / 73 experiments (1975–1987). His verdict: the empirical support for variable > constant practice was much weaker and more inconsistent than textbooks implied, with clearer support in children than adults **(the adult/child split is per secondary summaries — unverified)**. **PRIMARY review / CONTESTED.**
- **Especial skills — Keetch, Schmidt, Lee & Young (2005),** *JEP: Human Perception & Performance* 31(5):970–978 — **VERIFIED, abstract read.** Skilled basketball players hit set shots from the 15-ft foul line *more accurately than predicted* from the neighbouring distances — a specificity bump that survived obscuring the court lines and was **absent for jump shots** (which are not massively practised at that one spot). Massive practice at one member of a class produces "an especial skill." **PRIMARY.** Follow-up review: **Keetch, Lee & Schmidt (2008),** *J. Sport & Exercise Psychology* 30:723–736 — "specificity embedded within generality." **VERIFIED.**
- **Breslin, Hodges, Steenson & Williams (2012),** *Acta Psychologica* 140:154–157 — **VERIFIED, abstract read.** Novices, 300 set-shot trials, constant (foul line only) vs variable (five distances). Both improved at 15 ft; only the **constant** group showed the especial-skill signature (actual > expected at the trained distance). "The type, rather than amount, of practice is important." **PRIMARY / RCT-BACKED.**
- **Variability dose — Caballero, Barbado, Peláez & Moreno (2024),** *PeerJ* 12:e17575 — **VERIFIED, abstract read.** 65 participants, serial throwing, four schedules with different variability loads over two weeks; tests at 96 h, 2 weeks, 1 month. All improved; the **low-variability** condition reduced error most; benefit of variability depended on the learner's baseline variability. Title: "More is not better." **PRIMARY / RCT-BACKED.**
- **Differential learning** — parent §4 (Schöllhorn; Tassignon 2021 meta: thin). **CONTESTED.**

**Caveats.** Especial-skill work is basketball; the mechanism (a specific memory representation, or specific visual context) is debated. The variability-benefits-transfer claim is real but smaller and less consistent than its reputation (Van Rossum). Differential learning's evidence is mostly from the originating lab.

**Coaching translation.** Ask *what this card is for*. A figure that will be danced one way, to one tempo, in one routine → repeat **that** version (especial-skill logic). A figure that must survive different partners, tempos and entries → vary within the visit, but at a *modest* variability load, and only once the base version is stable. Varying *tempo* specifically has independent support from the pianist study (Duke 2009: systematic tempo variation was a top-performer behaviour), so "same figure, slower / on tempo / faster" is the best-supported form of within-visit variation.

---

## §5 Session length and fatigue

**Finding.** No study fixes an optimal session length for motor learning, and there is no dance study relating rehearsal length to *learning*. What exists: (a) within-day massing is inferior to across-day spacing; (b) a long first bout can suppress the offline gain; (c) practising into muscle fatigue damages later learning; (d) dance-medicine data tie fatigue and exposure hours to injury.

**Evidence.**
- **Same-day vs next-day second session — Shea et al. (2000)** (§3): 20-min gap lost to 24-h gap. **PRIMARY / RCT-BACKED.**
- **Dail & Christina (2004),** *RQES* 75(2):148–155 — **VERIFIED citation.** 90 novice golfers: 240 putts in one day vs 60 per day for four days; the distributed group was better in acquisition *and* at 1, 7 and 28 days. Read within-session: a **240-rep single session was the losing condition**. **PRIMARY / RCT-BACKED (applied).**
- **Goedert & Miller (2008)** (§1.2): the 7-trial first bout on mirror tracing showed **no** offline gain; 1- or 3-trial bouts did, and ended better. The suggestion is that a long bout can *consume* the gain a shorter one would have left for consolidation. **PRIMARY / RCT-BACKED (single lab study).**
- **Brawn et al. (2010)** (§1.3): after *morning* training, performance deteriorated across the waking day; after *evening* training it held. Time-of-day effects on within-day decay are real in this task. **PRIMARY / CONTESTED interpretation.**
- **Branscheidt, Kassavetis, Anaya, Rogers, Huang, Lindquist & Celnik (2019),** *eLife* 8:e40578 — **VERIFIED, abstract read.** Muscle fatigue (loss of maximal force after exertion) "impairs motor-skill learning beyond its effects on task execution … evidenced by impaired task acquisition on subsequent practice days even in the absence of fatigue"; the effect is partly central and was alleviated by altering motor-cortex function (tDCS). Authors: "the common practice of training while, or beyond, fatigue levels should be carefully reconsidered." **PRIMARY / RCT-BACKED.**
- **Dance medicine — Liederbach & Compagno (2001),** *Journal of Dance Medicine & Science* 5(4):116–120 — **VERIFIED citation.** 500 injury reports from 644 dancers (conservatory, clinic, professional ballet company) over two years. Fatigue was flagged as a significant injury factor across self-report, POMS mood scores, **exposure hours on the day of injury**, time of injury, stage of season, and work intensity; "work of a highly intense or monotonous nature" is named as a risk clue. **PRIMARY (observational).** Exact hour thresholds are not in the abstract — **(unverified)**.
- **Fauntroy, Stork, Hansen-Honeycutt, Deu, Klee, Martin & Ambegaonkar (2023),** *JDMS* 27(2):92–98 — **VERIFIED, abstract read.** 72 collegiate dancers, 7 months; 18 injuries (0.5 per 1,000 exposure hours); relationships among sleep, dance hours and injury were **inconsistent**. **PRIMARY (observational) — a null on the simple "more hours → more injury" story at this scale.**

**Caveats.** The learning studies are lab tasks; "fatigue" in Branscheidt is force loss from a wrist-pinch protocol, not an hour of Quickstep. The dance data are about injury, not learning, and are correlational. No source supports a specific minute count — anything the app says about session length is an inference from the diminishing-returns / inhibition / fatigue triad.

**Coaching translation.** The evidence-supported rule is qualitative: **stop the technical, learning-focused part of a session before muscular fatigue**, and treat a within-session slump as inhibition/fatigue, not failure. Whatever is done tired should be low-stakes (stamina, marking — parent §9a), not the installation of a new figure.

---

## §6 Design implications for the app

Everything below is split into **what the evidence supports** (E) and **reasonable engineering defaults** (D, SPECULATIVE). The parent brief's TL;DR #1 applies throughout: never let the app treat good within-session performance as the goal.

### 6.1 Stopping rule per card (per visit)

- **(E)** The stopping criterion with the best support is *behavioural*, not numeric: **repeat until the error is corrected and the execution is stable, then stop** (Duke 2009). Stacking clean reps after that has fast-decaying value (Rohrer 2005/2006; Savion-Lemieux & Penhune 2005; Ghanamah 2020).
- **(E)** Reps *inside* a visit can be tight — no need to enforce rest between reps of a discrete figure (Lee & Genovese 1989).
- **(E)** Late-bout deterioration is expected and is a *switch/rest* signal, not a keep-going signal (Rickard 2008; Gupta & Rickard 2022).
- **(D, SPECULATIVE)** Implement as a **"clean-streak" rule with a cap**: the visit ends when the dancer logs *k* consecutive self-rated clean reps (default *k* = 2 for an established card, *k* = 3 for a card that is new-but-stable), **or** when a hard cap of ~8–10 reps is reached, **or** when the dancer logs two consecutive worse-than-before reps (inhibition signal). The cap exists to prevent grinding; its value is a guess bounded by Goedert & Miller's "7 was too many" for a fine-motor task and Ghanamah's "intermediate dose" result — neither is a dance number.
- **(D)** Ask for a **self-rating before any playback/feedback** (parent §2, error-estimation protocol). The streak counter should run on the *estimate*, which also gives the app the success signal it needs for 6.2.

### 6.2 Contingent switching: win-shift / lose-stay

- **(E)** Switch-after-success with a **lenient** criterion (one hit) produced random-like retention in the lab; requiring **two** consecutive hits produced blocked-like retention (Simon et al. 2008). In a complex sport skill with novices, switch-after-success improved transfer only, and blocked won retention (Porter et al. 2020).
- **(E)** The applied CI benefit is ≈ 0.2 SD, ≈ 0 for under-18s (Czyż 2024; Brady 2004; Ammar 2023). Do not sell the switching rule as a big win.
- **(D, SPECULATIVE)** Use the *k* in 6.1 as the CI dial: **k = 1** (switch after the first clean rep) approximates random practice; **k = 2–3** approximates blocked. Gate it by card maturity (6.5). Never switch on a *failed* rep — "lose-stay" is the half of the rule both studies agree on, and it matches Duke's "address the error immediately."
- **(D)** Offer a **manual "stay" / "next" override** at all times. Self-regulated switching did at least as well as any imposed schedule (Keetch & Lee 2007; Wu & Magill 2011), the evidence for a *benefit* is weak (parent §2 caveats), but the evidence for *harm* is nil and the autonomy is cheap.

### 6.3 A second visit to the same card later in the session

- **(E)** No direct evidence; the CI literature is the proxy and says "small positive for adults, zero for youth." Reconstruction theory (Lee & Magill 1983) gives a mechanism for the value of a cold-start rep.
- **(D, SPECULATIVE)** Default: **one visit per card per session**, with an optional **"cold check"** — a single rep of each card practised earlier, in random order, at the end of the session (a mini retention test, not more drilling). Log the cold check separately from the visit; it is the *better* signal of what was learned (§1.3) and feeds the between-session scheduler in the other file. Re-open a full second visit only if the cold check fails.
- **(D)** If a session has fewer than three due cards, do not pad with repeat visits; end the session early instead (§5).

### 6.4 How to vary a rep

- **(E)** Constant practice of the exact competition version has instance-specific value (Keetch 2005; Breslin 2012). Variable practice has real but overstated transfer benefits (Van Rossum 1990), and *more* variability is not better (Caballero 2024). Systematic **tempo** variation is the one within-visit variation with independent support (Duke 2009).
- **(D, SPECULATIVE)** Give each card a **"target" variant** (the one it will actually be danced as) and optional **"spread" variants** (slower / faster tempo; different entry figure; different amount of travel). Visit structure: target variant until stable → one or two spread variants → **end on the target variant**. For cards flagged "competition routine," skip the spread entirely. Do not vary within the first visits of a new card.
- **(D)** Prefer tempo and entry as variation axes over "do it differently" prompts (differential learning is CONTESTED; parent §4).

### 6.5 How card maturity changes the rules

| Card state | Evidence | Default rule (SPECULATIVE) |
|---|---|---|
| **New** (first sessions; not yet reproducible) | Novices learn more blocked (Hebert 1996; Guadagnoli 1999); high load → reduce load (Wulf & Shea 2002); youth CI ≈ 0 (Czyż 2024; Bertollo 2010) | Blocked visit; *k* = 3; no variation; no contingent switch — place it first in the session while fresh; hard cap still applies |
| **Stabilising** (reproducible, error-prone) | Increasing-CI schedule beat both pure schedules (Porter & Magill 2010); lose-stay (Simon 2008) | Serial position in the session (rotate with other stabilising cards); *k* = 2; introduce tempo variation; lose-stay active |
| **Established** (clean on cold check) | CI benefit for adults on distinct movements (Czyż 2024 lab; Magill & Hall 1990) | Random position; *k* = 1 (win-shift); spread variants on; end on target variant |
| **Competition-locked** | Especial skills (Keetch 2005; Breslin 2012) | Target variant only; constant practice; low rep count; cold check every session |

- **(D)** For a user flagged under 18, keep every card one row *more conservative* than the table (the youth estimate is ≈ 0 for CI, and Bertollo's dance null was in adolescents).

### 6.6 Session-level rules

- **(E)** Stop technical work before muscular fatigue (Branscheidt 2019); fatigue and exposure hours track injury in dancers (Liederbach & Compagno 2001). Long single-day massing lost to spreading (Dail & Christina 2004; Shea 2000).
- **(D, SPECULATIVE)** Order the session: **new cards first, established cards later**, so the load-sensitive learning happens fresh (Wulf & Shea's load argument). Show an end-of-session prompt when the dancer logs fatigue or when two consecutive cards show the inhibition pattern, rather than a fixed timer. If a timer is wanted as a guard-rail, make it a *soft* one (e.g. suggest a pause after ~25–30 min of technical work) and say plainly in the UI that the number is a default, not a finding.
- **(D)** Put the **cold check** (6.3) last, then end. Do not run a second technical block after it.

### 6.7 What the app should *not* claim

- That interleaving will make a big difference (applied ≈ 0.2 SD; youth ≈ 0).
- That any rep count is optimal.
- That a good-looking end of visit means the figure is learned (it is the *worst* moment to judge — §1.3).
- That letting the user choose the order improves learning (plausible, unproven).

---

## Sources

### §1 Dose, overlearning, reactive inhibition, music pedagogy
- **[PRIMARY — chapter, not retrieved]** Newell, A. & Rosenbloom, P. S. (1981). Mechanisms of skill acquisition and the law of practice. In J. R. Anderson (Ed.), *Cognitive Skills and Their Acquisition* (pp. 1–55). Erlbaum. **(unverified pages)**
- **[PRIMARY]** Heathcote, A., Brown, S. & Mewhort, D. J. K. (2000). The power law repealed: The case for an exponential law of practice. *Psychonomic Bulletin & Review*, 7(2), 185–207. https://doi.org/10.3758/BF03212979 · https://pubmed.ncbi.nlm.nih.gov/10909131/ **VERIFIED.**
- **[META]** Driskell, J. E., Willis, R. P. & Copper, C. (1992). Effect of overlearning on retention. *Journal of Applied Psychology*, 77(5), 615–622. https://doi.org/10.1037/0021-9010.77.5.615 **VERIFIED citation; numbers (unverified).**
- **[PRIMARY]** Rohrer, D., Taylor, K., Pashler, H., Wixted, J. T. & Cepeda, N. J. (2005). The effect of overlearning on long-term retention. *Applied Cognitive Psychology*, 19(3), 361–374. https://doi.org/10.1002/acp.1083 · PDF: https://www.yorku.ca/ncepeda/publications/RTPWC2005.pdf **VERIFIED.**
- **[PRIMARY]** Rohrer, D. & Taylor, K. (2006). The effects of overlearning and distributed practise on the retention of mathematics knowledge. *Applied Cognitive Psychology*, 20, 1209–1224. https://doi.org/10.1002/acp.1266 · PDF: http://uweb.cas.usf.edu/~drohrer/pdfs/Rohrer&Taylor2006ACP.pdf **VERIFIED.**
- **[PRIMARY]** Savion-Lemieux, T. & Penhune, V. B. (2005). The effects of practice and delay on motor skill learning and retention. *Experimental Brain Research*, 161, 423–431. https://doi.org/10.1007/s00221-004-2085-9 **VERIFIED, abstract read.**
- **[PRIMARY]** Goedert, K. M. & Miller, J. (2008). Spacing practice sessions across days earlier rather than later in training improves performance of a visuomotor skill. *Experimental Brain Research*, 189, 189–197. https://doi.org/10.1007/s00221-008-1414-9 **VERIFIED, abstract read.**
- **[PRIMARY]** Ghanamah, R., Eghbaria-Ghanamah, H., Karni, A. & Adi-Japha, E. (2020). Too little, too much: A limited range of practice 'doses' is best for retaining grapho-motor skill in children. *Learning and Instruction*, 69, 101351. https://doi.org/10.1016/j.learninstruc.2020.101351 **VERIFIED citation; results from indexed abstract.**
- **[PRIMARY]** Rickard, T. C., Cai, D. J., Rieth, C. A., Jones, J. & Ard, M. C. (2008). Sleep does not enhance motor sequence learning. *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 34(4), 834–842. https://doi.org/10.1037/0278-7393.34.4.834 **VERIFIED, abstract read.**
- **[PRIMARY]** Brawn, T. P., Fenn, K. M., Nusbaum, H. C. & Margoliash, D. (2010). Consolidating the effects of waking and sleep on motor-sequence learning. *Journal of Neuroscience*, 30(42), 13977–13982. https://doi.org/10.1523/JNEUROSCI.3295-10.2010 **VERIFIED, abstract read.**
- **[PRIMARY]** Gupta, M. W. & Rickard, T. C. (2022). Dissipation of reactive inhibition is sufficient to explain post-rest improvements in motor sequence learning. *npj Science of Learning*, 7, 25. https://doi.org/10.1038/s41539-022-00140-z **VERIFIED, abstract read.**
- **[PRIMARY / CONTESTED]** Bönstrup, M., Iturrate, I., Thompson, R., Cruciani, G., Censor, N. & Cohen, L. G. (2019). A rapid form of offline consolidation in skill learning. *Current Biology*, 29(8), 1346–1351. https://doi.org/10.1016/j.cub.2019.02.049 · PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC6482074/ **VERIFIED, full text read** (author list beyond Bönstrup/Iturrate/Cohen (unverified)).
- **[PRIMARY]** Duke, R. A., Simmons, A. L. & Cash, C. D. (2009). It's not how much; it's how: Characteristics of practice behavior and retention of performance skills. *Journal of Research in Music Education*, 56(4), 310–321. https://doi.org/10.1177/0022429408328851 **VERIFIED citation; behaviour list and numbers via secondary summary (unverified).**
- **[PRIMARY]** Maynard, L. M. (2006). The role of repetition in the practice sessions of artist teachers and their students. *Bulletin of the Council for Research in Music Education*, 167, 61–72. **VERIFIED citation only.**
- **[PRIMARY]** Stambaugh, L. A. (2011). When repetition isn't the best practice strategy: Effects of blocked and random practice schedules. *Journal of Research in Music Education*, 58(4), 368–383. https://doi.org/10.1177/0022429410385945 **VERIFIED.**
- **[PRIMARY]** Carter, C. E. & Grahn, J. A. (2016). Optimizing music learning: Exploring how blocked and interleaved practice schedules affect advanced performance. *Frontiers in Psychology*, 7, 1251. https://doi.org/10.3389/fpsyg.2016.01251 · PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC4989027/ **VERIFIED, full text read.**
- **[PRIMARY]** Mathias, T. & Goldman, A. (2024/2025). How does increasing contextual interference in a musical practice session affect acquisition and retention? *Journal of Research in Music Education*, 72(4), 357–375. https://doi.org/10.1177/00224294231222801 **VERIFIED citation; winning condition (unverified).**

### §2 Interleaving — lab effect, mechanisms, meta-analyses, moderators, switching
- **[PRIMARY]** Magill, R. A. & Hall, K. G. (1990). A review of the contextual interference effect in motor skill acquisition. *Human Movement Science*, 9, 241–289. https://doi.org/10.1016/0167-9457(90)90005-X **VERIFIED.**
- **[PRIMARY]** Lee, T. D., Wulf, G. & Schmidt, R. A. (1992). Contextual interference in motor learning: Dissociated effects due to the nature of task variations. *Quarterly Journal of Experimental Psychology*, 44A(4), 627–644. https://doi.org/10.1080/14640749208401303 **VERIFIED.**
- **[PRIMARY]** Wulf, G. & Lee, T. D. (1993). Contextual interference in movements of the same class: Differential effects on program and parameter learning. *Journal of Motor Behavior*, 25(4), 254–263. https://doi.org/10.1080/00222895.1993.9941646 **VERIFIED.**
- **[PRIMARY]** Lee, T. D. & Magill, R. A. (1983). The locus of contextual interference in motor-skill acquisition. *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 9, 730–746. **VERIFIED citation.**
- **[PRIMARY]** Shea, J. B. & Zimny, S. T. (1983). Context effects in memory and learning movement information. In R. A. Magill (Ed.), *Memory and Control of Action* (pp. 345–366). North-Holland. **VERIFIED citation; pages (unverified).**
- **[PRIMARY review]** Wright, D., Verwey, W., Buchanan, J., Chen, J., Rhee, J. & Immink, M. (2016). Consolidating behavioral and neurophysiologic findings to explain the influence of contextual interference during motor sequence learning. *Psychonomic Bulletin & Review*, 23(1), 1–21. https://doi.org/10.3758/s13423-015-0887-3 **VERIFIED.**
- **[META]** Brady, F. (1998). A theoretical and empirical review of the contextual interference effect and the learning of motor skills. *Quest*, 50(3), 266–293. https://doi.org/10.1080/00336297.1998.10484285 **VERIFIED.**
- **[META]** Brady, F. (2004). Contextual interference: A meta-analytic study. *Perceptual and Motor Skills*, 99, 116–126. https://doi.org/10.2466/pms.99.1.116-126 · PDF: https://gwern.net/doc/psychology/spaced-repetition/2004-brady.pdf **VERIFIED.**
- **[META]** Ammar, A., Trabelsi, K., Boujelbane, M. A., Boukhris, O., Glenn, J. M., Chtourou, H. & Schöllhorn, W. I. (2023). The myth of contextual interference learning benefit in sports practice: A systematic review and meta-analysis. *Educational Research Review*, 39, 100537. https://doi.org/10.1016/j.edurev.2023.100537 **VERIFIED citation; effect sizes not retrieved (abstract page blocked) — counts from indexed summary.**
- **[META]** Ammar, A., Trabelsi, K., Boujelbane, M. A., Salem, A., Boukhris, O., Glenn, J. M., Zmijewski, P., Jahrami, H., Chtourou, H. & Schöllhorn, W. I. (2024). The effects of contextual interference learning on the acquisition and relatively permanent gains in skilled performance: A critical systematic review with multilevel meta-analysis. *Educational Psychology Review*, 36(2). https://doi.org/10.1007/s10648-024-09892-z **VERIFIED, abstract read.**
- **[META]** Czyż, S. H., Wójcik, A. M., Solarská, P. & Kiper, P. (2024). High contextual interference improves retention in motor learning: systematic review and meta-analysis. *Scientific Reports*, 14, 15974. https://doi.org/10.1038/s41598-024-65753-3 · PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC11237090/ **VERIFIED, results read.**
- **[META]** Czyż, S. H., Wójcik, A. M. & Solarská, P. (2024). The effect of contextual interference on transfer in motor learning — a systematic review and meta-analysis. *Frontiers in Psychology*, 15, 1377122. https://doi.org/10.3389/fpsyg.2024.1377122 **VERIFIED, results read.**
- **[CONTESTED — commentary]** Ammar, A. & Schöllhorn, W. I. (2024). Comment on Czyż et al. (2024) on contextual interference in motor learning. *SportRxiv* preprint 435. https://sportrxiv.org/index.php/server/preprint/view/435 · Czyż rebuttal: preprint 437 · Czyż, S. H. (2025). Commentary on Ammar et al. (2024). *Educational Psychology Review*, 37(2). https://doi.org/10.1007/s10648-025-10006-6 · "Advancing contextual interference…" (2025). *Educational Psychology Review*. https://doi.org/10.1007/s10648-025-10043-1 **(authorship unverified)**.
- **[PRIMARY]** Hebert, E. P., Landin, D. & Solmon, M. A. (1996). Practice schedule effects on the performance and learning of low- and high-skilled students: An applied study. *Research Quarterly for Exercise and Sport*, 67(1), 52–58. **VERIFIED citation.**
- **[PRIMARY]** Guadagnoli, M. A., Holcomb, W. R. & Weber, T. J. (1999). The relationship between contextual interference effects and performer expertise on the learning of a putting task. *Journal of Human Movement Studies*, 37, 19–36. **VERIFIED citation.**
- **[PRIMARY review]** Wulf, G. & Shea, C. H. (2002). Principles derived from the study of simple skills do not generalize to complex skill learning. *Psychonomic Bulletin & Review*, 9(2), 185–211. https://doi.org/10.3758/BF03196276 · PDF: https://gwulf.faculty.unlv.edu/wp-content/uploads/2014/05/Wulf_Shea-2002.pdf **VERIFIED.**
- **[PRIMARY]** Porter, J. M. & Magill, R. A. (2010). Systematically increasing contextual interference is beneficial for learning sport skills. *Journal of Sports Sciences*, 28(12), 1277–1285. https://doi.org/10.1080/02640414.2010.502946 · https://pubmed.ncbi.nlm.nih.gov/20845219/ **VERIFIED.**
- **[PRIMARY — dance]** Bertollo, M., Berchicci, M., Carraro, A., Comani, S. & Robazza, C. (2010). Blocked and random practice organization in the learning of rhythmic dance step sequences. *Perceptual and Motor Skills*, 110(1), 77–84. https://doi.org/10.2466/pms.110.1.77-84 **VERIFIED, abstract read.**
- **[PRIMARY]** Simon, D. A., Lee, T. D. & Cullen, J. D. (2008). Win-shift, lose-stay: Contingent switching and contextual interference in motor learning. *Perceptual and Motor Skills*, 107(2), 407–418. https://doi.org/10.2466/pms.107.2.407-418 · https://pubmed.ncbi.nlm.nih.gov/19093603/ **VERIFIED.**
- **[PRIMARY]** Porter, C., Greenwood, D., Panchuk, D. & Pepping, G.-J. (2020). Learner-adapted practice promotes skill transfer in unskilled adults learning the basketball set shot. *European Journal of Sport Science*, 20(1), 61–71. https://doi.org/10.1080/17461391.2019.1611931 **VERIFIED, abstract read.**
- **[PRIMARY / CONTESTED]** Keetch, K. M. & Lee, T. D. (2007). The effect of self-regulated and experimenter-imposed practice schedules on motor learning for tasks of varying difficulty. *Research Quarterly for Exercise and Sport*, 78(5), 476–486. https://doi.org/10.1080/02701367.2007.10599447 **VERIFIED, abstract read.**
- **[PRIMARY / CONTESTED]** Wu, W. F. W. & Magill, R. A. (2011). Allowing learners to choose: Self-controlled practice schedules for learning multiple movement patterns. *Research Quarterly for Exercise and Sport*, 82(3), 449–457. https://doi.org/10.1080/02701367.2011.10599777 **VERIFIED, abstract read.**

### §3 Within-session revisiting and distribution
- **[META / review]** Lee, T. D. & Genovese, E. D. (1988). Distribution of practice in motor skill acquisition: Learning and performance effects reconsidered. *Research Quarterly for Exercise and Sport*, 59(4), 277–287. https://doi.org/10.1080/02701367.1988.10609373 · PDF: https://gwern.net/doc/psychology/spaced-repetition/1988-lee.pdf **VERIFIED.**
- **[PRIMARY]** Lee, T. D. & Genovese, E. D. (1989). Distribution of practice in motor skill acquisition: Different effects for discrete and continuous tasks. *Research Quarterly for Exercise and Sport*, 60(1), 59–65. https://doi.org/10.1080/02701367.1989.10607414 **VERIFIED, abstract read.**
- **[PRIMARY]** Shea, C. H., Lai, Q., Black, C. & Park, J.-H. (2000). Spacing practice sessions across days benefits the learning of motor skills. *Human Movement Science*, 19(5), 737–760. https://doi.org/10.1016/S0167-9457(00)00021-X **VERIFIED citation.**

### §4 Variability within a visit
- **[PRIMARY review / CONTESTED]** Van Rossum, J. H. A. (1990). Schmidt's schema theory: The empirical base of the variability of practice hypothesis. A critical analysis. *Human Movement Science*, 9, 387–435. https://doi.org/10.1016/0167-9457(90)90010-B **VERIFIED.**
- **[PRIMARY]** Keetch, K. M., Schmidt, R. A., Lee, T. D. & Young, D. E. (2005). Especial skills: Their emergence with massive amounts of practice. *Journal of Experimental Psychology: Human Perception and Performance*, 31(5), 970–978. https://doi.org/10.1037/0096-1523.31.5.970 **VERIFIED, abstract read.**
- **[PRIMARY]** Keetch, K. M., Lee, T. D. & Schmidt, R. A. (2008). Especial skills: Specificity embedded within generality. *Journal of Sport & Exercise Psychology*, 30, 723–736. https://doi.org/10.1123/jsep.30.6.723 **VERIFIED.**
- **[PRIMARY]** Breslin, G., Hodges, N. J., Steenson, A. & Williams, A. M. (2012). Constant or variable practice: Recreating the especial skill effect. *Acta Psychologica*, 140, 154–157. https://doi.org/10.1016/j.actpsy.2012.04.002 **VERIFIED, abstract read.**
- **[PRIMARY]** Caballero, C., Barbado, D., Peláez, M. & Moreno, F. J. (2024). Applying different levels of practice variability for motor learning: More is not better. *PeerJ*, 12, e17575. https://doi.org/10.7717/peerj.17575 **VERIFIED, abstract read.**

### §5 Session length and fatigue
- **[PRIMARY]** Dail, T. K. & Christina, R. W. (2004). Distribution of practice and metacognition in learning and long-term retention of a discrete motor task. *Research Quarterly for Exercise and Sport*, 75(2), 148–155. https://doi.org/10.1080/02701367.2004.10609146 **VERIFIED citation.**
- **[PRIMARY]** Branscheidt, M., Kassavetis, P., Anaya, M., Rogers, D., Huang, H. D., Lindquist, M. A. & Celnik, P. (2019). Fatigue induces long-lasting detrimental changes in motor-skill learning. *eLife*, 8, e40578. https://doi.org/10.7554/eLife.40578 **VERIFIED, abstract read.**
- **[PRIMARY — dance]** Liederbach, M. & Compagno, J. M. (2001). Psychological aspects of fatigue-related injuries in dancers. *Journal of Dance Medicine & Science*, 5(4), 116–120. https://doi.org/10.1177/1089313X0100500403 **VERIFIED citation; abstract via index.**
- **[PRIMARY — dance]** Fauntroy, V., Stork, A., Hansen-Honeycutt, J., Deu, R., Klee, H., Martin, J. & Ambegaonkar, J. P. (2023). Sleep, dance exposure hours, and injury risk in collegiate dancers. *Journal of Dance Medicine & Science*, 27(2), 92–98. https://doi.org/10.1177/1089313X231177179 **VERIFIED, abstract read.**

---

*Compiled 2026-09-06 as a companion to `motorLearningForDance.md`. Sources were retrieved via journal pages, Europe PMC, OpenAlex/Crossref records and open-access author copies; PubMed and several publisher abstract pages were unreachable during compilation, so where a number rests on an indexed abstract or a secondary summary rather than the paper it is marked (unverified). All §6 numbers (k, rep caps, minute guard-rails) are engineering defaults and are labelled SPECULATIVE on purpose.*

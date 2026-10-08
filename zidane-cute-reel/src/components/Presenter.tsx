// Corporate-illustration presenter: realistic proportions, flat two-tone shading.
// Pakistani man, mid-30s: short side-parted hair, trimmed beard, navy blazer, white shirt, red Zidane pin.
// Drawn in a 1000×1100 box; mouth (0..1), blink, brows, head tilt and one gesturing hand are animatable.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export type PBrow = "neutral" | "raised" | "concern" | "confident";
export type PGesture = "rest" | "open" | "point" | "count";

const C = {
  skin: "#C08A62",
  skinShade: "#A8724D",
  skinLight: "#D19B72",
  hair: "#16110F",
  hairHi: "#2A211D",
  beard: "#1C1613",
  lip: "#8E4F45",
  mouth: "#3A1716",
  teeth: "#F3EEE8",
  white: "#F7F5F2",
  iris: "#3B2618",
  navy: "#1F2A44",
  navyShade: "#172036",
  navyLight: "#2A3756",
  shirt: "#F1F2F4",
  shirtShade: "#D9DCE2",
  red: "#C22A2F",
  chair: "#2B2E34",
};

export const Presenter: React.FC<{ mouth: number; brow: PBrow; gesture: PGesture; gestureT: number; tilt?: number }> = ({
  mouth, brow, gesture, gestureT, tilt = 0,
}) => {
  const frame = useCurrentFrame();
  const cyc = frame % 96;
  const blink = cyc > 90 ? interpolate(cyc, [90, 92, 95], [1, 0.1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const breathe = Math.sin(frame / 20) * 3;
  const headTilt = tilt + Math.sin(frame / 37) * 1.2 + mouth * Math.sin(frame / 3.3) * 0.6;
  const browY = { neutral: 0, raised: -9, concern: -4, confident: 2 }[brow];
  const browRot = { neutral: 0, raised: -3, concern: 9, confident: -5 }[brow];
  const lookX = Math.sin(frame / 53) * 1.5;
  const o = Math.max(0, Math.min(1, mouth));
  return (
    <svg viewBox="0 0 1000 1100" width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="blazer" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={C.navyShade} /><stop offset="0.45" stopColor={C.navy} /><stop offset="1" stopColor={C.navyLight} />
        </linearGradient>
        <linearGradient id="face" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={C.skinShade} /><stop offset="0.35" stopColor={C.skin} /><stop offset="0.75" stopColor={C.skinLight} /><stop offset="1" stopColor={C.skin} />
        </linearGradient>
      </defs>

      {/* chair back */}
      <rect x={250} y={430} width={500} height={700} rx={90} fill={C.chair} />

      {/* torso */}
      <g transform={`translate(0 ${breathe})`}>
        {/* shirt + neck */}
        <path d="M446 520 L554 520 C556 580 566 630 590 680 L410 680 C434 630 444 580 446 520 Z" fill={C.skinShade} />
        <path d="M446 540 C470 575 530 575 554 540 L556 590 C530 610 470 610 444 590 Z" fill="#8F5E3F" opacity={0.55} />
        <path d="M120 1100 C130 820 210 700 360 660 L500 640 L640 660 C790 700 870 820 880 1100 Z" fill="url(#blazer)" />
        <path d="M262 770 C238 870 228 980 224 1100" stroke={C.navyShade} strokeWidth={8} fill="none" opacity={0.7} />
        <path d="M738 770 C762 870 772 980 776 1100" stroke={C.navyShade} strokeWidth={8} fill="none" opacity={0.5} />
        {/* shirt V */}
        <path d="M410 655 L500 860 L590 655 L560 640 L500 700 L440 640 Z" fill={C.shirt} />
        <path d="M440 640 L500 700 L470 720 L418 660 Z" fill={C.shirtShade} />
        <path d="M560 640 L500 700 L530 720 L582 660 Z" fill={C.shirt} />
        {/* lapels */}
        <path d="M360 662 L410 655 L500 860 L470 900 L405 760 L340 740 Z" fill={C.navyShade} />
        <path d="M640 662 L590 655 L500 860 L530 900 L595 760 L660 740 Z" fill={C.navyLight} />
        {/* pin */}
        <circle cx={655} cy={800} r={14} fill={C.red} stroke="#fff" strokeWidth={3} />
        <text x={655} y={806} textAnchor="middle" fontSize={16} fontWeight={800} fill="#fff" fontFamily="Sora, sans-serif">Z</text>
      </g>

      {/* head */}
      <g transform={`translate(0 ${breathe * 0.6}) rotate(${headTilt} 500 560)`}>
        {/* ears */}
        <path d="M368 400 C340 395 336 455 372 470 Z" fill={C.skinShade} />
        <path d="M632 400 C660 395 664 455 628 470 Z" fill={C.skin} />
        {/* face */}
        <path d="M372 330 C372 250 430 222 500 222 C570 222 628 250 628 330 L628 430 C628 500 590 560 500 572 C410 560 372 500 372 430 Z" fill="url(#face)" />
        {/* hair */}
        <path d="M366 360 C356 270 400 205 470 196 C540 188 610 205 636 262 C648 290 644 330 634 360 C628 320 616 296 596 284 C560 268 520 270 470 262 C430 258 400 270 384 300 C376 318 372 340 366 360 Z" fill={C.hair} />
        <path d="M430 228 C470 214 540 214 580 232 C540 228 480 230 430 246 Z" fill={C.hairHi} />
        {/* beard (trimmed, follows jaw) */}
        <path d="M374 390 C374 470 400 540 446 566 C470 580 530 580 554 566 C600 540 626 470 626 390 L612 392 C606 430 596 452 578 466 C560 470 548 468 540 470 C536 512 520 530 500 532 C480 530 464 512 460 470 C452 468 440 470 422 466 C404 452 394 430 388 392 Z" fill={C.beard} opacity={0.22} />
        <path d="M376 410 C378 490 404 550 448 572 C472 584 528 584 552 572 C596 550 622 490 624 410 C614 452 600 478 578 492 C566 486 556 484 546 486 C540 520 522 536 500 538 C478 536 460 520 454 486 C444 484 434 486 422 492 C400 478 386 452 376 410 Z" fill={C.beard} />
        {/* moustache */}
        <path d="M444 478 C466 464 488 466 500 474 C512 466 534 464 556 478 C540 482 520 482 500 486 C480 482 460 482 444 478 Z" fill={C.beard} />
        {/* mouth */}
        {o > 0.06 ? (
          <g>
            <path d={`M462 492 Q500 ${492 - 2} 538 492 Q${538 - 6} ${500 + o * 26} 500 ${502 + o * 30} Q${462 + 6} ${500 + o * 26} 462 492 Z`} fill={C.mouth} />
            <path d={`M470 493 Q500 491 530 493 L528 ${497 + o * 4} Q500 ${495 + o * 3} 472 ${497 + o * 4} Z`} fill={C.teeth} opacity={o > 0.25 ? 1 : 0} />
          </g>
        ) : (
          <path d="M464 494 Q500 506 536 494" stroke={C.lip} strokeWidth={6} fill="none" strokeLinecap="round" />
        )}
        {/* nose */}
        <path d="M500 380 C494 410 484 432 486 446 C494 454 512 454 520 446" stroke={C.skinShade} strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d="M486 446 C492 452 508 452 514 446" stroke="#8A5A3C" strokeWidth={4} fill="none" strokeLinecap="round" />
        {/* eyes */}
        {[440, 560].map((x, i) => (
          <g key={x} transform={`translate(${x} 382) scale(1 ${blink}) translate(${-x} -382)`}>
            <path d={`M${x - 26} 384 Q${x} 364 ${x + 26} 384 Q${x} 396 ${x - 26} 384 Z`} fill={C.white} />
            <circle cx={x + lookX} cy={382} r={10} fill={C.iris} />
            <circle cx={x + lookX + 3} cy={378} r={3} fill="#fff" />
            <path d={`M${x - 28} 383 Q${x} 361 ${x + 28} 383`} stroke={C.hair} strokeWidth={5} fill="none" strokeLinecap="round" />
            <path d={`M${x - 20} 396 Q${x} 402 ${x + 20} 396`} stroke={C.skinShade} strokeWidth={3} fill="none" opacity={0.7} />
            {/* brow */}
            <path
              transform={`translate(0 ${browY}) rotate(${(i === 0 ? 1 : -1) * browRot} ${x} 346)`}
              d={i === 0 ? `M${x - 34} 352 Q${x - 4} 334 ${x + 30} 342 L${x + 30} 350 Q${x - 4} 344 ${x - 32} 360 Z` : `M${x + 34} 352 Q${x + 4} 334 ${x - 30} 342 L${x - 30} 350 Q${x + 4} 344 ${x + 32} 360 Z`}
              fill={C.hair}
            />
          </g>
        ))}
        {/* cheek shadow for depth */}
        <path d="M380 430 C390 480 420 520 452 530 C420 500 400 470 392 420 Z" fill={C.skinShade} opacity={0.35} />
      </g>

      <Hand gesture={gesture} t={gestureT} frame={frame} />
    </svg>
  );
};

// One gesturing hand (viewer's right). Rests below frame, rises to a pose.
const Hand: React.FC<{ gesture: PGesture; t: number; frame: number }> = ({ gesture, t, frame }) => {
  if (gesture === "rest") return null;
  const target = { open: { x: 735, y: 760, r: 8 }, point: { x: 690, y: 820, r: -20 }, count: { x: 720, y: 770, r: 0 }, rest: { x: 760, y: 1200, r: 0 } }[gesture];
  const x = interpolate(t, [0, 1], [780, target.x]);
  const y = interpolate(t, [0, 1], [1250, target.y]) + Math.sin(frame / 9) * 4;
  return (
    <g>
      {/* sleeve */}
      <path d={`M860 1100 C850 980 ${x + 40} ${y + 160} ${x + 10} ${y + 70} L${x - 50} ${y + 90} C${x - 20} ${y + 200} 790 1000 780 1100 Z`} fill={C.navy} />
      <rect x={x - 46} y={y + 54} width={92} height={22} rx={8} fill={C.shirt} transform={`rotate(${target.r * t} ${x} ${y + 64})`} />
      <g transform={`translate(${x} ${y}) rotate(${target.r * t})`}>
        {gesture === "point" ? (
          <g>
            <rect x={-36} y={-30} width={72} height={86} rx={30} fill={C.skin} />
            <rect x={-10} y={-120} width={22} height={100} rx={11} fill={C.skin} />
          </g>
        ) : (
          <g>
            <rect x={-40} y={-20} width={80} height={80} rx={30} fill={C.skin} />
            {[-30, -10, 10, 30].map((fx, i) => {
              const up = gesture === "count" ? (i < 1 + (Math.floor(frame / 20) % 4) ? 1 : 0.35) : 1;
              const h = 70 * up;
              return <rect key={fx} x={fx - 9} y={-20 - h} width={18} height={h + 10} rx={9} fill={i % 2 ? C.skin : C.skinLight} />;
            })}
            <rect x={-62} y={0} width={40} height={20} rx={10} fill={C.skin} transform="rotate(-30 -40 10)" />
          </g>
        )}
      </g>
    </g>
  );
};

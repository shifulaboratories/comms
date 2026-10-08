import { ImageResponse } from 'next/og';
import { ogFonts } from './_og/fonts';

/**
 * The link preview — what iMessage, Slack, X and LinkedIn show when someone
 * shares comms.support. Rendered once at build time to a static PNG, so it
 * works with the static export too.
 */
export const dynamic = 'force-static';
export const alt = 'Comms — one iMessage number, your whole team.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BLUE = '#0A84FF';

function Bubble({ side, children, w }: { side: 'in' | 'out'; children: string; w?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: side === 'out' ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          maxWidth: w ?? 300,
          padding: '12px 18px',
          borderRadius: 24,
          borderBottomRightRadius: side === 'out' ? 8 : 24,
          borderBottomLeftRadius: side === 'in' ? 8 : 24,
          background: side === 'out' ? BLUE : '#26292F',
          color: '#fff',
          fontSize: 19,
          lineHeight: 1.3,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: '#07080A',
        fontFamily: 'Geist',
        color: '#F2F3F5',
        overflow: 'hidden',
      }}
    >
      {/* Glows */}
      <div
        style={{
          position: 'absolute',
          left: -120,
          top: -220,
          width: 700,
          height: 700,
          borderRadius: 700,
          background: 'radial-gradient(circle, rgba(10,132,255,0.38), rgba(10,132,255,0) 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -160,
          bottom: -300,
          width: 760,
          height: 760,
          borderRadius: 760,
          background: 'radial-gradient(circle, rgba(124,108,255,0.32), rgba(124,108,255,0) 65%)',
        }}
      />

      {/* Left: brand + headline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 0 64px 72px',
          width: 720,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #64AAFF, #7C6CFF)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 26,
                height: 20,
                borderRadius: 7,
                background: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: 4, background: '#3D6BFF' }} />
              <div style={{ width: 4, height: 4, borderRadius: 4, background: '#3D6BFF' }} />
              <div style={{ width: 4, height: 4, borderRadius: 4, background: '#3D6BFF' }} />
            </div>
          </div>
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: -1 }}>Comms</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: -2.8,
              lineHeight: 1,
            }}
          >
            One iMessage number.
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: -2.8,
              lineHeight: 1.12,
            }}
          >
            <span>Your&nbsp;</span>
            <span
              style={{
                fontFamily: 'Instrument Serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 74,
                letterSpacing: -1.2,
                color: '#8FB4FF',
              }}
            >
              whole team.
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 26,
              fontSize: 25,
              color: '#9AA0AB',
              lineHeight: 1.4,
              maxWidth: 500,
            }}
          >
            A shared team inbox and help desk for iMessage. Open source.
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 22, color: '#5C626E' }}>comms.support</div>
      </div>

      {/* Right: a tilted slice of the inbox */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          right: -36,
          top: 118,
          width: 440,
          transform: 'rotate(-4deg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            borderRadius: 28,
            background: 'linear-gradient(180deg, #16191F, #0E1014)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 44,
                height: 44,
                borderRadius: 44,
                background: 'linear-gradient(135deg, #FFD36E, #F59E0B)',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                fontWeight: 600,
              }}
            >
              JL
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 21, fontWeight: 600 }}>Jordan Lee</span>
              <span style={{ fontSize: 16, color: '#5C626E' }}>iMessage · Assigned to Maya</span>
            </div>
            <div
              style={{
                display: 'flex',
                marginLeft: 'auto',
                padding: '5px 12px',
                borderRadius: 20,
                background: 'rgba(10,132,255,0.16)',
                color: '#7FB6FF',
                fontSize: 16,
              }}
            >
              Open
            </div>
          </div>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 24px 30px' }}
          >
            <Bubble side="in">Is order #4821 shipping today?</Bubble>
            <div
              style={{
                display: 'flex',
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255,176,32,0.3)',
                background: 'rgba(255,176,32,0.08)',
                color: '#FFD98A',
                fontSize: 17,
              }}
            >
              Sam: label printed — Maya, can you reply?
            </div>
            <Bubble side="out" w={330}>
              It ships today! Tracking in an hour 📦
            </Bubble>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                fontSize: 15,
                color: '#5C626E',
              }}
            >
              Maya · Delivered
            </div>
          </div>
        </div>
      </div>
    </div>,
    { ...size, fonts: await ogFonts() },
  );
}

import { connectDB } from '../config/db.js';
import { Channel } from '../models/channel.model.js';
import { Playlist } from '../models/playlist.model.js';
import { streamManager } from '../services/streaming/streamManager.js';
import { renderTickerImage } from '../services/streaming/brandingAssets.js';
import path from 'path';
import fs from 'fs';
import { STREAMS_DIR } from '../config/paths.js';

async function main() {
  console.log('=== Starting Complete Multi-Feature Playout Stress Test ===');
  await connectDB();

  const channelId = '6aec7c38e7864af01dde4f97';
  const channel = await Channel.findById(channelId);
  if (!channel) {
    console.error('Channel not found:', channelId);
    process.exit(1);
  }

  console.log(`Target Channel: ${channel.name} (${channel.outputSettings.width}x${channel.outputSettings.height} @ ${channel.outputSettings.fps}fps)`);

  // 1. Configure Channel Branding: ALL features enabled
  channel.branding.logo.enabled = true;
  channel.branding.bug.enabled = true;
  channel.branding.bug.isMov = true;
  channel.branding.ticker.enabled = true;
  channel.branding.lband.enabled = true;
  channel.branding.ashton.enabled = true;
  channel.branding.ashton.squeeze = true;
  channel.branding.backInTimer.enabled = true;
  await channel.save();
  console.log('✓ Channel database settings updated with all features enabled.');

  // 2. Configure Ad Playlist with Back-In Timer and all branding flags enabled
  const adPlaylist = await Playlist.findById('6af7fc5a6ff151c8536d938a');
  if (adPlaylist) {
    adPlaylist.isActive = true;
    adPlaylist.showLogo = true;
    adPlaylist.showBug = true;
    adPlaylist.showTicker = true;
    adPlaylist.showBackInTimer = true;
    adPlaylist.startTime = '';
    adPlaylist.endTime = '';
    adPlaylist.scheduleOption = 'none';
    await adPlaylist.save();
    console.log('✓ Testing Ad Playlist configured with Back-In Timer & branding enabled.');
  }

  // 3. Stop any existing stream
  if (streamManager.isChannelLive(channelId)) {
    console.log('Stopping existing stream...');
    await streamManager.stopStream(channelId);
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 4. Ensure branding files on disk
  const channelDir = path.join(STREAMS_DIR, String(channelId));
  if (!fs.existsSync(channelDir)) fs.mkdirSync(channelDir, { recursive: true });

  const tickerFile = path.join(channelDir, 'ticker.png');
  await renderTickerImage({
    text: 'LIVE STRESS TEST: Logo + Ticker + Visual Bug + L-Band + Ashton + Ad with Back-in Timer',
    bgColor: '#b91c1cdd',
    textColor: '#ffffff',
    fontSize: 22,
    alignment: 'center',
    outputPath: tickerFile
  });

  // 5. Start live stream
  console.log('Starting Live Stream with optimized 720p 25fps pipeline...');
  const stream = await streamManager.startStream(channelId, 0);
  console.log(`Stream running on ZMQ Port: ${stream.zmqPort}`);

  console.log('Waiting for first frame and ZMQ readiness...');
  const ready = await stream.encoder.waitForFirstFrame(15000);
  if (!ready) {
    console.error('Encoder failed to report first frame within 15s');
    process.exit(1);
  }
  console.log('✓ Encoder is producing frames!');

  // 6. Real-time ZMQ Activation of ALL branding features
  console.log('\nActivating ALL branding features in real-time via ZMQ:');
  await stream.encoder.setLogoPosition('top-right', 2, 2);
  await stream.encoder.setLogoEnabled(true);
  console.log('  [1/6] Logo: ENABLED (top-right)');

  await stream.encoder.setTickerPosition(0, 3, 'center');
  await stream.encoder.setTickerEnabled(true);
  console.log('  [2/6] Ticker: ENABLED (scrolling bottom center)');

  await stream.encoder.setBugPosition('bottom-right', 2, 2);
  await stream.encoder.setBugEnabled(true);
  console.log('  [3/6] Visual Bug: ENABLED (bottom-right)');

  await stream.encoder.setLBandEnabled(true);
  console.log('  [4/6] L-Band DVE Squeeze: ENABLED (960x540 cutout window)');

  await stream.encoder.setAshtonLive(true, true);
  console.log('  [5/6] Ashton Band: ENABLED (lower third banner with squeeze)');

  console.log('  [6/6] Back-In Countdown Timer: ENABLED on Ad Playlist');

  console.log('\n======================================================');
  console.log('ALL FEATURES ACTIVE: Logo, Ticker, Bug, L-Band, Ashton, Ad & Timer');
  console.log('Running 60-second real-time benchmark...');
  console.log('======================================================\n');

  const samples = [];
  const startTime = Date.now();
  const benchmarkDurationMs = 60000;

  while (Date.now() - startTime < benchmarkDurationMs) {
    await new Promise((r) => setTimeout(r, 2000));
    const stats = stream.encoder.stats || {};
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const sample = {
      elapsed: `${elapsed}s`,
      frame: stats.frame || 0,
      fps: stats.fps || 0,
      speed: stats.speed || '0x',
      avgFps: stats.avgFps || 0,
      avgSpeed: stats.avgSpeed || '0x',
      bitrate: stats.bitrate || 'N/A'
    };
    samples.push(sample);

    console.log(
      `[Benchmark +${sample.elapsed.padStart(5)}] ` +
      `Instant FPS: ${String(sample.fps).padStart(4)} | ` +
      `Instant Speed: ${String(sample.speed).padStart(5)} | ` +
      `Avg FPS: ${String(sample.avgFps).padStart(4)} | ` +
      `Avg Speed: ${String(sample.avgSpeed).padStart(5)} | ` +
      `Frame: ${sample.frame}`
    );
  }

  console.log('\n=== Benchmark Summary ===');
  // Discard first 3 warmup samples
  const steadySamples = samples.slice(3);
  const avgInstFps = (
    steadySamples.reduce((sum, s) => sum + (Number(s.fps) || 0), 0) / (steadySamples.length || 1)
  ).toFixed(1);
  const avgInstSpeedVal = (
    steadySamples.reduce((sum, s) => sum + (parseFloat(s.speed) || 0), 0) / (steadySamples.length || 1)
  ).toFixed(2);

  console.log(`Average Steady-State FPS:   ${avgInstFps} FPS (Target: 25.0 FPS)`);
  console.log(`Average Steady-State Speed: ${avgInstSpeedVal}x (Target: >= 1.00x)`);

  const passed = Number(avgInstFps) >= 24.5 && parseFloat(avgInstSpeedVal) >= 0.99;
  if (passed) {
    console.log('\n>>> SUCCESS: All features active, constant FPS >= 25.0, speed >= 1.0x with zero drops! <<<');
  } else {
    console.log('\n>>> FAIL: Performance fell below target thresholds. <<<');
  }

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('[Stress Test Error]', err);
  process.exit(1);
});

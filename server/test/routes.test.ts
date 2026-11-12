import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteDirectory, legFor, parseStandingData } from '../src/flights/routes.js';

const STANDING_DATA = [
  'Callsign,Code,Number,AirlineCode,AirportCodes',
  'ETD597,ETD,597,ETD,OMAA-LLBG',
  'BAW982,BAW,982,BAW,EGLL-EDDB',
  'POE217,POE,217,POE,CYQT-CYTZ-CYOW-CYSJ',
  'XYZ1,XYZ,1,XYZ,ZZZZ-LLBG',
  'EVA6,EVA,6,EVA,RCTP-KLAX',
].join('\r\n');

const download = (csv: string, status = 200) => new Response(gzipSync(csv), { status });

describe('route directory', () => {
  let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchFn = vi.fn<typeof fetch>();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  const loaded = async (csv = STANDING_DATA) => {
    fetchFn.mockResolvedValueOnce(download(csv));
    const routes = createRouteDirectory(fetchFn);
    await routes.load();
    return routes;
  };

  it('shows a known flight with airport codes and cities passengers recognise', async () => {
    const routes = await loaded();
    expect(routes.routeFor('ETD597')).toEqual({
      from: 'AUH',
      fromCity: 'Abu Dhabi',
      to: 'TLV',
      toCity: 'Tel Aviv',
    });
    expect(routes.routeFor('BAW982')).toMatchObject({ from: 'LHR', to: 'BER', toCity: 'Berlin' });
  });

  it('downloads the whole list once and answers every lookup from memory', async () => {
    const routes = await loaded();
    routes.routeFor('ETD597');
    routes.routeFor('BAW982');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe('https://vrs-standing-data.adsb.lol/routes.csv.gz');
  });

  it('finds a flight broadcast with a zero-padded number', async () => {
    const routes = await loaded();
    expect(routes.routeFor('EVA006')).toMatchObject({ from: 'TPE', fromCity: 'Taoyuan', to: 'LAX' });
  });

  it('shows no route for a flight it does not know, or one with stopovers, rather than a wrong one', async () => {
    const routes = await loaded();
    expect(routes.routeFor('ISR047')).toBeNull();
    expect(routes.routeFor('POE217')).toBeNull();
  });

  it('shows the leg a flight with stopovers is clearly flying, from the plane it is asked about', async () => {
    const routes = await loaded(`${STANDING_DATA}
SWA2515,SWA,2515,SWA,KSJC-KLAX-KMDW-KBWI`);
    const nearLax = { lat: 33.95, lon: -118.34 };

    expect(routes.routeFor('SWA2515', { ...nearLax, verticalRateFpm: -800 })).toMatchObject({
      from: 'SJC',
      to: 'LAX',
    });
    expect(routes.routeFor('SWA2515', { ...nearLax, verticalRateFpm: 1500 })).toMatchObject({
      from: 'LAX',
      to: 'MDW',
    });
    expect(routes.routeFor('SWA2515')).toBeNull();
  });

  it('shows the airport code when it does not know the city', async () => {
    const routes = await loaded();
    expect(routes.routeFor('XYZ1')).toMatchObject({ from: 'ZZZZ', fromCity: 'ZZZZ', to: 'TLV' });
  });

  it('keeps the routes it has when a later download fails', async () => {
    const routes = await loaded();
    fetchFn.mockResolvedValueOnce(download('', 503));
    await routes.load();
    expect(routes.routeFor('ETD597')).toMatchObject({ to: 'TLV' });
  });

  it('counts the distinct flights asked for and how many had a route, then starts over', async () => {
    const routes = await loaded();
    for (const flight of ['ETD597', 'ETD597', 'ISR047', 'BAW982']) routes.routeFor(flight);

    expect(routes.takeCoverage()).toEqual({ asked: 3, found: 2 });
    expect(routes.takeCoverage()).toEqual({ asked: 0, found: 0 });
  });

  it('knows no routes until the first download, without failing', () => {
    expect(createRouteDirectory(fetchFn).routeFor('ETD597')).toBeNull();
  });
});

describe('parseStandingData', () => {
  it('reads the callsign and airports, skipping the header and blank lines', () => {
    expect([...parseStandingData(`${STANDING_DATA}\r\n`)]).toEqual([
      ['ETD597', 'OMAA-LLBG'],
      ['BAW982', 'EGLL-EDDB'],
      ['POE217', 'CYQT-CYTZ-CYOW-CYSJ'],
      ['XYZ1', 'ZZZZ-LLBG'],
      ['EVA6', 'RCTP-KLAX'],
    ]);
  });
});

describe('legFor', () => {
  const nearJfk = { lat: 40.64, lon: -73.78 };

  it('keeps a direct route whatever the plane is doing', () => {
    expect(legFor(['OMAA', 'LLBG'])).toEqual(['OMAA', 'LLBG']);
    expect(legFor(['OMAA', 'LLBG'], { ...nearJfk, verticalRateFpm: 0 })).toEqual(['OMAA', 'LLBG']);
  });

  it('tells the two legs of an out-and-back flight apart by climb or descent', () => {
    const stops = ['KJFK', 'TJSJ', 'KJFK'];
    expect(legFor(stops, { ...nearJfk, verticalRateFpm: 2000 })).toEqual(['KJFK', 'TJSJ']);
    expect(legFor(stops, { ...nearJfk, verticalRateFpm: -900 })).toEqual(['TJSJ', 'KJFK']);
  });

  it('shows no leg when the plane is level, far from every stop, or near two of them', () => {
    const stops = ['KSJC', 'KLAX', 'KMDW', 'KBWI'];
    expect(legFor(stops, { lat: 33.95, lon: -118.34, verticalRateFpm: 100 })).toBeNull();
    expect(legFor(stops, { lat: 33.95, lon: -118.34 })).toBeNull();
    expect(legFor(stops, { lat: 32.0, lon: 34.8, verticalRateFpm: -900 })).toBeNull();
    expect(legFor(['KORD', 'KEWR', 'KJFK'], { lat: 40.75, lon: -73.98, verticalRateFpm: -900 })).toBeNull();
  });
});

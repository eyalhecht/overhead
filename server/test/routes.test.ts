import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouteDirectory, parseStandingData } from '../src/flights/routes.js';

const STANDING_DATA = [
  'Callsign,Code,Number,AirlineCode,AirportCodes',
  'ETD597,ETD,597,ETD,OMAA-LLBG',
  'BAW982,BAW,982,BAW,EGLL-EDDB',
  'POE217,POE,217,POE,CYQT-CYTZ-CYOW-CYSJ',
  'XYZ1,XYZ,1,XYZ,ZZZZ-LLBG',
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

  it('shows no route for a flight it does not know, or one with stopovers, rather than a wrong one', async () => {
    const routes = await loaded();
    expect(routes.routeFor('ISR047')).toBeNull();
    expect(routes.routeFor('POE217')).toBeNull();
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
    ]);
  });
});

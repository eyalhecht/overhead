import type { ActivityProps, CardStage } from './index.js';

const STATUS_WORDS: Record<CardStage, string> = {
  approaching: 'Approaching',
  overhead: 'Above you now',
  passed: 'Passed',
};

export interface CardText {
  status: string;
  title: string;
  details: string;
}

export type LiveActivityContent = ActivityProps & CardText;

export function cardText({ stage, route, airline, aircraft, flight }: ActivityProps): CardText {
  return {
    status: STATUS_WORDS[stage],
    title: route ? `${route.fromCity} → ${route.toCity}` : 'Route unknown',
    details: [airline ?? flight, aircraft].filter(Boolean).join(' · '),
  };
}

export function liveActivityContent(props: ActivityProps): LiveActivityContent {
  return { ...props, ...cardText(props) };
}

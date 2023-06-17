import twilio from 'twilio';
import axios from 'axios';
import cheerio from 'cheerio';
import Diff from 'text-diff';
import { Redis } from '@upstash/redis';
import { NextApiRequest, NextApiResponse } from 'next';

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

const twilio_client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const URL = 'https://www.barbete.com/mobile-menu';

// The DOM structure of this page is very messy, hence all the manual string juggling/parsing

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { data } = await axios.get(URL);

    const $ = cheerio.load(data);

    let page_content: string[] = [];

    $('.sqs-block-content p').each((_idx, el) => {
      page_content.push($(el).text());
    });

    // cut off text from food allergy warning and below
    const end = page_content.findIndex((e) =>
      e.includes('Consuming raw or undercooked meats'),
    );
    page_content = page_content.slice(0, end);

    // match menu item groups
    const regex = /(([A-Z]+?[\s,\-,&]+){1,})[a-z,à-ÿ,' ',\d,&,-]+/gm;

    // iterate over regex match groups, remove consecutive whitespaces
    let parsed = Array.from(page_content.join().matchAll(regex), (m) => m[0])
      .map((e) => e.trim())
      .map((e) => e.replace(/\s\s+/g, ' '));

    let storedpage_content = await redis.get<Array<string>>('content');

    const html = getDiffHtml(storedpage_content!.join(), parsed.join());
    const menu_inserts = getInserts(html);

    const message_body = getMessageBody(menu_inserts);

    if (menu_inserts.length) {
      await sendSMS(message_body);
      await redis.set('content', parsed);
    }

    res.status(200).json(message_body);
  } catch (e) {
    throw e;
  }
}

function getDiffHtml(a: string, b: string) {
  const diff = new Diff();
  let text_diff = diff.main(a, b);
  diff.cleanupSemantic(text_diff);
  const html: string = diff.prettyHtml(text_diff);
  return html;
}

function getInserts(str: string) {
  return Array.from(str.matchAll(/<ins>(.+?)<\/ins>/g), (m) => m[1]);
}

async function sendSMS(message: string) {
  await twilio_client.messages.create({
    body: message,
    to: process.env.SMS_PHONE_NUM!,
    from: process.env.TWILIO_PHONE_NUM,
  });
}

function getMessageBody(menu_inserts: string[], length?: number) {
  const response_body = menu_inserts
    .filter((e) => /^[A-Z]+/.test(e) && e.length > 3)
    .join('\n');

  const msg =
    'New items at Bar Bete:\n' + response_body.slice(0, length ?? 300);

  return msg;
}

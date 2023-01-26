import twilio from 'twilio';
import axios from "axios";
import cheerio from "cheerio";
import Diff from 'text-diff';
import { Redis } from '@upstash/redis';
import { NextApiRequest, NextApiResponse } from "next";

const TWILIO_ACCOUNT_SID = 'ACd998ee990bc7bd549b1ee1aa1eeffe24';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const twilio_client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const redis = new Redis({
  // @ts-ignore
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const URL = 'https://www.barbete.com/mobile-menu';

// The DOM structure of this page is very messy, hence all the manual string juggling/parsing

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {

    const { data } = await axios.get(URL);

    const $ = cheerio.load(data);

    let content: string[] = [];

    $('.sqs-block-content > p').each((_idx, el) => {
      content.push($(el).text())
    });

    // cut off text from food allergy warning and below
    const end = content.findIndex(e => e.includes('Consuming raw or undercooked meats'));
    content = content.slice(0, end);

    const str = content.join();

    // match menu item groups
    const regex = /(([A-Z]+?[\s,\-,&]+){1,})[a-z,à-ÿ,' ',\d,&,-]+/gm;

    // iterate over regex match groups, remove consecutive whitespaces
    const result = Array.from(str.matchAll(regex), m => m[0])
      .map(e => e.trim())
      .map(e => e.replace(/\s\s+/g, ' '));

    // await redis.set('content', result);

    let stored = await redis.get('content') as Array<string>;

    const stored_text = stored.join()
      .replace('ISLAND CREEK OYSTERS chili oil, meyer lemon mignonette 4ea', 'CRISPY HALIBUT sriracha sauce 8')
      .replace('DUCK FAT POTATOES parsley, garlic aioli 9', 'BRAISED CABBAGE SLAW')

    const diff = new Diff();
    let text_diff = diff.main(stored_text, result.join());
    diff.cleanupSemantic(text_diff)
    const html: string = diff.prettyHtml(text_diff);

    let ins = Array.from(html.matchAll(/<ins>(.+?)<\/ins>/g), m => m[1]);

    const response_body = ins.filter(e => (/^[A-Z]+/.test(e)) && e.length > 3).join('\n')

    // console.log(response_body);

    const message_body = "New items at Bar Bete:\n" + response_body.slice(0, 300);

    await twilio_client.messages.create({
      body: message_body,
      to: '+14152331791',
      from: '+18558193039'
    });

    res.status(200).json(message_body);
  } catch (e) {
    throw e;
  }
}

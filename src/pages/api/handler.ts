import axios from "axios";
import cheerio from "cheerio";
import { NextApiRequest, NextApiResponse } from "next";

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


    const end = content.findIndex(e => e.includes('Consuming raw or undercooked meats'));

    content = content.slice(0, end);

    const str = content.join();

    const regex = /(([A-Z]+?[\s,\-,&]+){1,})[a-z,à-ÿ,' ',\d,&,-]+/gm;

    const result = Array.from(str.matchAll(regex), m => m[0]).map(e => e.trim());

    console.log(result)

    res.status(200).json(result);
  } catch (e) {
    throw e;
  }
}


// Importação das bibliotecas necessárias
import _ from 'lodash';
import puppeteer from 'puppeteer-extra';
import pluginStealth from 'puppeteer-extra-plugin-stealth';
import adBlocker from 'puppeteer-extra-plugin-adblocker';

/**
 * Return recipes from site tudogostoso.com.br
 * @param mainUrl 
 * @param totalOfPages 
 * @param openBrowser 
 */
const tudoGostoso = (mainUrl: string, totalOfPages: number = 0, openBrowser = false) => {
    
    puppeteer.use(pluginStealth());
    puppeteer.use(adBlocker({ blockTrackers: true }));    

    puppeteer.launch({
        headless:!openBrowser,
        args: ['--start-maximized']
    }).then( async browser => {

      const page = await browser.newPage();

      console.log(`Fetching page data for : ${mainUrl}...`);
      await page.goto(mainUrl);
      await page.waitForSelector(".rounded");

      /**
       * Return number of total pages of recipes
       */
      async function getLastPage() {

        const lastPageValue = await page.$$eval(
          'div.pagination > div a',
          (links) => {
            let link = links.map(link => {
              if (link.innerText === '>>') {
                
                let lastPageNumber = link.getAttribute('href');

                if (lastPageNumber.lastIndexOf('&') > 0) {
                  lastPageNumber = lastPageNumber.substring(0, lastPageNumber.lastIndexOf('&'));
                }

                lastPageNumber = lastPageNumber.replace('/receitas?page=', '').trim();
                return lastPageNumber;
              };
            });
            link = link.filter(el => {return el != null});
            return link[0];
          }
        );

        return Number(lastPageValue);
      };

      /**
       * Get data inside pages
       */
      async function getData() {

        const recipes = [];

        const arrMainLinks = await page.$$eval(
          '.tdg-main > div > div > div > div.rounded > div.card.recipe-card.recipe-card-with-hover',
          (links) => links.map(link => {
            const a = link.querySelector('a');
            const name = link.querySelector('a > .recipe-box > .recipe-title');
            return {
              name: String(name.innerText).toLowerCase(),
              link: a.href
            }
          })
        );

        console.log(`Number of links: ${arrMainLinks.length}`);

        const page2 = await browser.newPage();
        for (const {name, link} of arrMainLinks) {
          await Promise.all([
            page2.waitForNavigation(),
            page2.goto(link),
            page2.waitForSelector('h1')
          ]);

          console.log('Get recipe ' + name);

          const recipeTitle = await page2.$eval('h1', e => e.innerText.toLowerCase());
          const recipeTime = await page2.$eval('.preptime', e => e.innerText.toLowerCase());
          const recipePotion = await page2.$eval('.yield', e => e.innerText.toLowerCase());
          const recipeRating = await page2.$eval('.like > .num', e => e.innerText.toLowerCase());
          const recipeAuthor = await page2.$eval('.author-name > span', e => e.innerText.toLowerCase());
          const recipeLink = link;
          
          const recipeImage = await page2.$eval(
            '.recipe-media',
            media => {
              const image = media.querySelector('img.pic');
              if (image !== null) {
                return image.src;
              }
              return null;
            }
          );
          
          let recipeImageAlt = null;
          if (recipeImage !== null) {recipeImageAlt = await page2.$eval('img.pic', e => e.alt.toLowerCase());} 

          const recipeCategory = await page2.$$eval(
            '.breadcrumb > li',
            (list) => {
              let category = list.map(li => {
                const meta = li.querySelector('meta');
                if (Number(meta.content) === 2) {
                  const category = String(li.querySelector('a > span').innerText).toLowerCase().trim();
                  return category;
                };
              });
              category = category.filter(el => {return el != null});
              return category[0];
            }
          );

          let recipeStuff = await page2.$$eval(
            '.ingredients-card > ul > li',
            (list) => list.map(li => {
              return li.innerText.toLowerCase().trim();
            })
          );
          const recipeStuffString = recipeStuff.join('|');

          let recipeInstructions = await page2.$$eval(
            '.instructions > ol > li',
            (list) => list.map(li => {
              return li.innerText.toLowerCase().trim();
            })
          );
          const recipeInstructionsString = recipeInstructions.join('|');

          const recipe = {
            recipeTitle,
            recipeCategory,
            recipeTime,
            recipePotion,
            recipeRating,
            recipeAuthor,
            recipeImage,
            recipeImageAlt,
            recipeLink,
            recipeStuffString,
            recipeInstructionsString
          }

          recipes.push(recipe);
        }

        await page2.close();

        return recipes;
      }

      /**
       * Return the recipes of pages
       * @param totalOfPages Number of pages to get recipes
       */
      async function getRecipes(totalOfPages: number) {

        const recipes = [];

        for (var i = 0; i < totalOfPages; i++) {
          recipes.push(...await getData());
          await page.click('.tdg-main > div > div > div > div.rounded > div.pagination > div a.next');
          await page.waitForSelector(".rounded");
        }

        return recipes;
      }

      if (totalOfPages === 0) {
        totalOfPages = Number(await getLastPage());
      }

      const resultListOfRecipes = await getRecipes(totalOfPages);
      console.log(resultListOfRecipes);
      console.log(`Captured recipes: ${resultListOfRecipes.length}`);

      await browser.close();

    });
}

export default tudoGostoso;
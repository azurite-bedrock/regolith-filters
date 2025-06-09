
# Marathon
## What is this?
Marathon is a regolith (or standalone) script which supports running other small worker scripts (referred as generators from now on). These generators can be used to automate tasks, such as generating big amounts of blocks, items, entities or features at once.

## How do you use it?
For a free standing generator (any generator not located in the data/marathon directory) you can simply place a `SCRIPT_NAME_HERE.ts/js` and the script will be ran once marathon runs.
If you would like to create a script which is not free standing you place the script in the `data/marathon` directory of the project. This generator will be treated the exact same.

## API
When a generator is invoked it has its [current working directory](https://en.wikipedia.org/wiki/Working_directory) set to the location the generator is in. 
Example:
If a filter is located in `BP/Items/Wool` the [current working directory](https://en.wikipedia.org/wiki/Working_directory) will be `BP/Items/Wool`.
 
## Environment Variables
Before a generator is invoke marathon sets up many [environment variables](https://en.wikipedia.org/wiki/Environment_variable). There is a single static one which is always there. `MARATHON_ROOT_DIR`. This  [environment variable](https://en.wikipedia.org/wiki/Environment_variable) points to the root folder marathon has been configured with; by default this is the directory that marathon is invoked in.

### Dynamic Environment Variables
Marathon creates an [environment variable](https://en.wikipedia.org/wiki/Environment_variable) for each sub directory of the `BP` and `RP` folders. Meaning if you have a folder such as `BP/blocks` there will be an  [environment variable](https://en.wikipedia.org/wiki/Environment_variable) called `BP_BLOCKS`, this goes for `RP` and `BP`. 

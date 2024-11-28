const fs = require('fs');
const util = require('util');
const YAML = require('yamljs');
const path = require('path');
const { execSync } = require('child_process');

const readFileAsync = util.promisify(fs.readFile)

class ConfigManager {
  async refresh () {
    this._config = null
    await this.getConfig()
  }

  async getServers () {
    const conf = await this.getConfig()
    return Object.keys(conf.servers)
  }

  async getConfig () {
    if (this._config) {
      return this._config
    }
    const paths = []
    if (process.env.SCREEPS_CONFIG) {
      paths.push(process.env.SCREEPS_CONFIG)
    }
    const dirs = [__dirname, '']
    for (const dir of dirs) {
      paths.push(path.join(dir, '.screeps.yaml'))
      paths.push(path.join(dir, '.screeps.yml'))
    }
    if (process.platform === 'win32') {
      paths.push(path.join(process.env.APPDATA, 'screeps/config.yaml'))
      paths.push(path.join(process.env.APPDATA, 'screeps/config.yml'))
    } else {
      if (process.env.XDG_CONFIG_PATH) {
        paths.push(
          path.join(process.env.XDG_CONFIG_HOME, 'screeps/config.yaml')
        )
        paths.push(
          path.join(process.env.XDG_CONFIG_HOME, 'screeps/config.yml')
        )
      }
      if (process.env.HOME) {
        paths.push(path.join(process.env.HOME, '.config/screeps/config.yaml'))
        paths.push(path.join(process.env.HOME, '.config/screeps/config.yml'))
        paths.push(path.join(process.env.HOME, '.screeps.yaml'))
        paths.push(path.join(process.env.HOME, '.screeps.yml'))
      }
    }
    for (const path of paths) {
      const data = await this.loadConfig(path)
      if (data) {
        if (!data.servers) {
          throw new Error(
            `Invalid config: 'servers' object does not exist in '${path}'`
          )
        }
        this._config = data
        this.path = path
        return data
      }
    }
    return null
  }

  async loadConfig (file) {
    try {
      const contents = await readFileAsync(file, 'utf8')
      return YAML.parse(contents)
    } catch (e) {
      if (e.code === 'ENOENT') {
        return false
      } else {
        throw e
      }
    }
  }
}

const main = async () => {
    const configMan = new ConfigManager();

    const config = await configMan.getConfig();

    const serverKeys = Object.keys(config.servers);

    for(const serverName of serverKeys) {
        const serverInfo = config.servers[serverName];

        // TODO: wasteful to run a rebuild every time we upload...?
        if (typeof serverInfo.obfuscate !== 'undefined' && serverInfo.obfuscate == true) {
            console.log(`Will upload to ${serverName} via an obfuscator`)

            execSync(`SERVER=${serverName} npm run upload-masked`, {stdio: 'inherit'});
        } else {
            console.log(`Will upload to ${serverName} via regular build`)

            execSync(`SERVER=${serverName} npm run upload`, {stdio: 'inherit'});
        }
    }
}

main();
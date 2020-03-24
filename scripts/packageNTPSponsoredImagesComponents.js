/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

const getComponentDataList = () => {
  return [
    { locale: 'DEMO',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw+cUN/flbETi5zyjp4tRW4ustichzvFqeY4ayWpi/r+TwRgUaf0IyK2GYZF1xBsiuGO3B321ptcF7lpru32dxc2GUX7GLVHnYw+kM9bfw3WVqLPXVozCbyjqCW8IQXuUljOJ4tD9gJe8xvBeZ/WKg2K+7sYuhov6mcbBoUd4WLZW+89ryuBfZFi/4U6MX4Hemsw40Z3KHf/gAHpXXeU65Sqb8AhVMp0nckaX5u4vN09OTHLPAmCZmps5TcExoYwSPQaFK+6HrUV0/66Xw3kqo05CvN3bCC1UlDk3KAffg3LZ8u1E3gFcwK6xSjHYknGOuxabTVS6cNGECOEWKVsURwIDAQAB',
      id: 'bejfdgcfgammhkbdmbaohoknehcdnbmn' }
  ]
}

const stageFiles = (locale, version, outputDir) => {
  // Copy resources and manifest file to outputDir.
  // Copy resource files
  const resourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'resources', locale, '/')
  console.log('copy dir:', resourceDir, ' to:', outputDir)
  fs.copySync(resourceDir, outputDir)

  // Fix up the manifest version
  const originalManifest = getOriginalManifest(locale)
  const outputManifest = path.join(outputDir, 'manifest.json')
  console.log('copy manifest file: ', originalManifest, ' to: ', outputManifest)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)
}

const generateManifestFile = (componentData) => {
  const manifestFile = getOriginalManifest(componentData.locale)
  const manifestContent = {
    description: 'Brave NTP sponsored images component',
    key: componentData.key,
    manifest_version: 2,
    name: 'Brave NTP sponsored images',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const generateManifestFiles = () => {
  getComponentDataList().forEach(generateManifestFile)
}

const getManifestsDir = () => {
  const targetResourceDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images', 'manifiest-files')
  mkdirp.sync(targetResourceDir)
  return targetResourceDir
}

const getOriginalManifest = (locale) => {
  return path.join(getManifestsDir(), `${locale}-manifest.json`)
}

const generateCRXFile = (binary, endpoint, region, keyDir, componentData) => {
  const originalManifest = getOriginalManifest(componentData.locale)
  const locale = componentData.locale
  const rootBuildDir = path.join(path.resolve(), 'build', 'ntp-sponsored-images')
  const stagingDir = path.join(rootBuildDir, 'staging', locale)
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentData.id).then((version) => {
    const crxFile = path.join(crxOutputDir, `ntp-sponsored-images-${locale}.crx`)
    // const privateKeyFile = path.join(keyDir, `ntp-sponsored-images-${locale}.pem`)
    const privateKeyFile = `ntp-sponsored-images-${locale}.pem`
    stageFiles(locale, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

commander
  .option('-b, --binary <binary>', 'Path to the Chromium based executable to use to generate the CRX file')
  .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files')
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-east-2')
  .parse(process.argv)

let keyDir = ''
// if (fs.existsSync(commander.keysDirectory)) {
//   keyDir = commander.keysDirectory
// } else {
//   throw new Error('Missing or invalid private key directory')
// }

if (!commander.binary) {
  throw new Error('Missing Chromium binary: --binary')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  generateManifestFiles()
  getComponentDataList().forEach(generateCRXFile.bind(null, commander.binary, commander.endpoint, commander.region, keyDir))
})

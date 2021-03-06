const {Builder, By, Key, util, WebElement} = require("selenium-webdriver")
var secretJson = require("./secret.json"); //See secretStruct.json to create your own secret.json
var fs = require('fs');
const { elementIsNotSelected } = require("selenium-webdriver/lib/until");

//discord
const Discord = require("discord.js");
const config = require("./config.json");
const client = new Discord.Client();
client.login(config.BOT_TOKEN);

////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////           Global Variables           ///////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

var departments = []
var diciplines = []
var activityList = {"quizes":[],"assigns":[]};
var jsonData = require("./activities.json");

var dateDict = {"jan":0,"fev":1,"mar":2,"abr":3,"mai":4,"jun":5,"jul":6,"ago":7,"set":8,"out":9,"nov":10,"dez":11};


/////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////               Discord               ////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////
const prefix = '&';

function getFullTimeName(time,timeName){
    var addTimeName = time === 1 ? timeName : timeName + "s";
    var addTimeVal = (time < 10) ? "0" + time : time;
    return addTimeVal + " " + addTimeName; 
}


function getRemainingTime(endDate){ //Used to calculate remaining time for given activity Date object time
    var currentTime = new Date();
    var remainingTime = (endDate.getTime() - currentTime.getTime());
    var symbol = "";
    if (remainingTime < 0){
        symbol = "-";
        remainingTime *= -1;
    }
    var seconds = Math.floor((remainingTime / (1000)) % 60),
        minutes = Math.floor((remainingTime / (1000 * 60)) % 60),
        hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24),
        days = Math.floor((remainingTime / (1000 * 60 * 60 * 24)) % 7),
        weeks = Math.floor(remainingTime / (1000 * 60 * 60 * 24*7));
    

    weeks = getFullTimeName(weeks,"semana");
    days = getFullTimeName(days,"dia");
    hours = getFullTimeName(hours,"hora");
    minutes = getFullTimeName(minutes,"minuto");
    seconds = getFullTimeName(seconds,"segundo");


    var remTimeStr = symbol + " " + weeks + ", " + days + ", " + hours + ", " + minutes + " e " + seconds;
    console.log(remTimeStr);
    return remTimeStr;
}




function listDiciplines(curJsonData){
    var texts = [];
    if (Object.keys(curJsonData).length === 0) texts.push('N??o h?? nenhuma diciplina listada');
    else texts.push('as diciplinas existentes s??o:\n');
    for(var diciplines in curJsonData){
        texts.push('```' + diciplines + '```');
    }
    return texts;
}

function getDiciplineDate(curJsonData,dicipline){
    var dates = [];
    var auxArray;
    var remainingTime;
    var activitiesTypes = ["assigns","quizes"];

    for(var i = 0;i<activitiesTypes.length;i++){
        auxArray = curJsonData[dicipline][activitiesTypes[i]];
        for(var j = 0;j<auxArray.length;j++) dates.push(auxArray[j]);
    }

    var iter = 0;
    while(iter < dates.length){
        remainingTime = getRemainingTime(new Date(dates[iter]["deadline"]));
        if(remainingTime !== null){
            dates[iter]["remainingTime"] = remainingTime;
            iter += 1;
        }
        else dates.splice(iter,1);
    }
    return dates;
}


function sendDiciplineDates(curJsonData,args){
    var texts = [];
    var auxArray = [];
    var chosenDiciplines = {};
    var argsSize = args.length;
    if (Object.keys(curJsonData).length === 0){
        texts.push('N??o h?? nenhuma diciplina listada');
        return texts;
    }
    if(argsSize === 0){
        chosenDiciplines = JSON.parse(JSON.stringify(curJsonData));
    }
    else{
        for(var dicipline in curJsonData){
            for(var i = 0;i<argsSize;i++){
                if(dicipline.includes(args[i].toUpperCase() + " - ")){
                    chosenDiciplines[dicipline] = JSON.parse(JSON.stringify(curJsonData[dicipline]));
                    continue;
                }
            }
        }
    }

    for(var dicipline in chosenDiciplines){
        auxArray = getDiciplineDate(curJsonData,dicipline);
        auxArray.unshift('**' + dicipline + '**');
        if(auxArray.length !== 1) texts.push(auxArray);
    }

    if(texts.length === 0){
        texts.push('Sem nenhuma atividade cadastrada');
    }
    else{
        texts.unshift('As atividades cadastradas s??o:\n')
    }
    return texts;
}


client.on("message", function(message) {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
    const curJsonData = JSON.parse(JSON.stringify(jsonData));
    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();

    switch (command){
        case "diciplinas":
            var texts = listDiciplines(curJsonData);
            message.reply(texts[0]);
            for(var i = 1;i<texts.length;i++) message.channel.send(texts[i]);
            break;

        case "prazos":
            var texts = sendDiciplineDates(curJsonData,args);
            message.reply(texts[0]);
            var msgStr;
            for(var i = 1;i<texts.length;i++){
                msgStr = '```\n' + texts[i][0] + '\n';
                for(var j = 1;j<texts[i].length;j++){
                    msgStr += texts[i][j]["title"] + ' - Tempo Restante: ' + texts[i][j]["remainingTime"] + '\n'
                }
                msgStr += '```';
                message.channel.send(msgStr);
            }
            break;

    }    
});




////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////           Base Methods           /////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

async function wait(timeInSeconds){ // Used to wait some time
    await new Promise(resolve => setTimeout(resolve, 1000*timeInSeconds));
}    


async function openWindow(driver,newWindowUrl,waitTime){ //Open new window and goes to that window
    await driver.executeScript('window.open("' + newWindowUrl + '");');
    
    let windows = await driver.getAllWindowHandles();
    await driver.switchTo().window(windows[windows.length - 1]);

    await wait(waitTime);
}

async function closeWindow(driver,waitTime,nextWindow=null){ //Close current window and go to passed window, or previous one, if no window is passed
    await driver.close();
    let windows = await driver.getAllWindowHandles();
    let toGoWindow = (nextWindow===null ? windows[windows.length - 1] : nextWindow);
    await driver.switchTo().window(toGoWindow);
    await wait(waitTime);
}


//All methods bellow use xPath to access an element

async function typeSlowly(driver,string,xpathStr,waitTimeKey,waitTimeEnd){ //Used to type
    for(const key of string){
        await driver.findElement(By.xpath(xpathStr)).sendKeys(key);
        await wait(waitTimeKey);
    }    
    await wait(waitTimeEnd);
}     


async function clickXPath(driver,xPathStr,waitTime=0){ //Used to click
    await driver.findElement(By.xpath(xPathStr)).click();
    await wait(waitTime);
}    
async function clickXPathTC(driver,xPathStr,errorMessage,waitTime){ //Used to click, with try/catch method
    let returnVal = true;
    try{
        await driver.findElement(By.xpath(xPathStr)).click();
    }
    catch(error){
        console.log(errorMessage);
        returnVal = false;
    }
    await wait(waitTime);
    return returnVal;
}
async function clickXPathWT(driver,xPathStr){ //Used to click, tries until is successfull
    var continueWhile = true;
    while(continueWhile === true){
        continueWhile = false;
        try{
            await clickXPath(driver,xPathStr);
        }    
        catch{
            continueWhile = true;
            await wait(0.5);
        }    
    }    
    return;
}    


async function getElements(driver,xPathStr,waitTime=0){ //Used to get elements array
    let elements = await driver.findElements(By.xpath(xPathStr));
    await wait(waitTime);
    return elements
}    
async function getElementsWT(driver,xPathStr){ //Used to get elements array, tries until is successfull
    var continueWhile = true;
    var elements = [];
    while(continueWhile === true){
        continueWhile = false;
        try{
            elements = await getElements(driver,xPathStr);
        }    
        catch{
            continueWhile = true;
            await wait(0.5);
        }    
    }    
    return elements;
}    


async function getElemByXPath(driver,xPathStr,waitTime=0){ //Used to get element
    var elem = await driver.findElement(By.xpath(xPathStr));
    await wait(waitTime);
    return elem;
}
async function getElemByXPathWT(driver,xPathStr){ //Used to get element, tries until is successfull
    var continueWhile = true;
    var element;
    while(continueWhile === true){
        continueWhile = false;
        try{
            element = await getElemByXPath(driver,xPathStr);
        }
        catch{
            continueWhile = true;
            await wait(0.5);
        }
    }
    return element;
}


async function getElemAttrByXPath(driver,xPathStr,attributeType,waitTime=0){ //Used to get element attribute
    var attribute = await driver.findElement(By.xpath(xPathStr)).getAttribute(attributeType);
    await wait(waitTime);
    return attribute;
}
async function getElemAttrByXPathWT(driver,xPathStr,attributeType){ //Used to get element attribute, tries until is successfull
    var continueWhile = true;
    var elemAttr;
    while(continueWhile === true){
        continueWhile = false;
        try{
            elemAttr = await getElemAttrByXPath(driver,xPathStr,attributeType);
        }
        catch{
            continueWhile = true;
            await wait(0.5);
        }
    }
    return elemAttr;
}
async function getElemAttrByXPathTC(driver,xPathStr,attributeType){ //Used to get element attribute, tries once
    try{
        var elemAttr = await getElemAttrByXPath(driver,xPathStr,attributeType);
    }
    catch{
        return null;
    }

    return elemAttr;
}


async function getElemsAttrByXPath(driver,xPathStr,attributeType,waitTime=0){ //Used to get element array attributes
    var elemAttrs = await driver.findElements(By.xpath(xPathStr))
    for(i = 0;i<elemAttrs.length;i++){
        elemAttrs[i] = await elemAttrs[i].getAttribute(attributeType);
    }
    await wait(waitTime);
    return elemAttrs;
}
async function getElemsAttrByXPathWT(driver,xPathStr,attributeType){ //Used to get element array attributes, tries until is successfull
    var continueWhile = true;
    var elemAttrs;
    while(continueWhile === true){
        continueWhile = false;
        try{
            elemAttrs = await getElemsAttrByXPath(driver,xPathStr,attributeType);
        }
        catch{
            continueWhile = true;
            await wait(0.5);
        }
    }
    return elemAttrs;
}

////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////               Main               /////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////

async function writeJson(){ //Write json file
    fs.writeFile('activities.json',JSON.stringify(jsonData), function (err,data) {
        if (err) {
            return console.log(err);
        }
        console.log("File Writen");
    });
}

async function fixTimes(time){
    var timeList = String(time).split(", ").slice(1,3).join(" ").split(":").join(" ").split(" ");
    var timeDateType = new Date(Number(timeList[2]),dateDict[timeList[1]],Number(timeList[0]),Number(timeList[3]),Number(timeList[4]));
    return timeDateType;
}

async function newActivity(activityTitle,activityType){ //Verify if activity is new or already loaded
    var activitiesLen;
    for(var diciplines in jsonData){
        activitiesLen = jsonData[diciplines][activityType].length;
        for(it4 = 0;it4<activitiesLen;it4++){
            if(jsonData[diciplines][activityType][it4]["title"] === activityTitle){
                console.log("\t\t\tActivity Already Loaded");
                return false;
            }
        }
    }
    return true;
}

async function activityIter(driver,it3,diciplineName,activityType,deadlineXPath,alternativeXPath=null){
    await openWindow(driver,activityList[activityType][it3]);

    var activityTitle = await getElemAttrByXPathWT(driver,"//h2","innerHTML"); //Get activity title
    if(await newActivity(activityTitle,activityType) === true){
        var deadlineStr = await getElemAttrByXPathTC(driver,deadlineXPath,"innerHTML");
        if(deadlineStr === null) deadlineStr = await getElemAttrByXPathWT(driver,alternativeXPath,"innerHTML");
        var deadline = await fixTimes(deadlineStr); //Adjust taken date
        
        //Add activity to the json
        var curActivityJson = {"title" :String(activityTitle),"deadline":deadline.toISOString()};        
        await jsonData[diciplineName][activityType].push(curActivityJson);
    }

    await closeWindow(driver);
    return;
}


async function diciplinesIter(driver,it2){
    var maxIt = 0;
    var iter = 0;

    await openWindow(driver,diciplines[it2]);

    await getElemByXPathWT(driver,"//h1"); //Assure the page is loaded

    var quizList = await getElemsAttrByXPathWT(driver,"//a[.//img[contains(@src,'quiz')]]","href"); //Get all quizes elements
    var assignList = await getElemsAttrByXPathWT(driver,"//a[.//img[contains(@src,'assign')]]","href"); //Get all assigns elements

    var diciplineName = await getElemAttrByXPathWT(driver,"//h1","innerHTML"); 
    if(!(diciplineName in jsonData)) jsonData[diciplineName] = {"assigns":[],"quizes":[]};

    if(quizList.length > 0 || assignList.length > 0){
        //Find if dicipline is already listed

        activityList["quizes"] = quizList;
        activityList["assigns"] = assignList;
        maxIt = quizList.length + assignList.length;
        iter = 0;

        //Iterate through all diciplines quizes
        for(it3 = 0;it3<quizList.length;it3++){
            iter += 1;
            console.log("\t\tActivities ",iter,"/",maxIt);
            await activityIter(driver,it3,diciplineName,"quizes","//p[contains(.,'O question??rio ser?? fechado em')]","//p[contains(.,'Este question??rio foi encerrado em')]");
        }
        //Iterate through all diciplines assigns
        for(it3 = 0;it3<assignList.length;it3++){
            iter += 1;
            console.log("\t\tActivities ",iter,"/",maxIt);
            await activityIter(driver,it3,diciplineName,"assigns","//tr[.//th[contains(.,'Data de entrega')]]//td");
        }
    }
    await closeWindow(driver);
    return;
}

async function departmentIter(driver,it1){
    //Finding diciplines general xPath
    let hrefAttr = await departments[it1].getAttribute("href");
    let diciplinesXPath ="//div[@id='" + String(hrefAttr).split("#")[1] + "']//h5[@class='item-cut']//a";

    await departments[it1].click(); //Go to department
    diciplines = await getElemsAttrByXPathWT(driver,diciplinesXPath,"href"); //Find all diciplines

    //Iterate through all department diciplines
    for (var it2 = 0; it2 < diciplines.length; it2++){
        console.log("\tDiciplines ",(it2+1),"/",diciplines.length);
        await diciplinesIter(driver,it2);
    }
    return;
}


async function fullIter(driver){ //Full process
    await getElemByXPathWT(driver,"//h1",false); //Assure the page is loaded
    departments = await getElementsWT(driver,"//a[contains(@class,'categorylink')]"); //Get all departments elements
    //Iterate through all departments
    for (it1 = 0; it1 < departments.length; it1++){
        console.log("Department ",(it1+1),"/",departments.length);
        await departmentIter(driver,it1);
    }
    return;
}


async function logEdisciplinas(driver){ //Login in E-disciplinas website
    await driver.get("https://edisciplinas.usp.br/acessar/");
    await clickXPathWT(driver,"//a[@href='https://edisciplinas.usp.br/auth/shibboleth']");
    await typeSlowly(driver,secretJson.login,"//input[@id='username']",0.05,0.1);
    await typeSlowly(driver,secretJson.senha,"//input[@id='password']",0.05,0.1);
    await clickXPathWT(driver,"//button[@type='submit']");
    console.log("Login done!");
}

async function manageWindow(driver){ //Maximize window
    await driver.manage().window().maximize();
}
/*
function readJson() { //Read json file
    jsonData = JSON.parse(fs.readFileSync('activities.json'));
    return;
}
*/


async function retrieveActivities(waitTime){
    let driver = await new Builder().forBrowser("firefox").build(); //Initialize driver
    await manageWindow(driver);
    await logEdisciplinas(driver);
    await fullIter(driver);
    await writeJson();
    driver.quit(); //End driver
    await wait(waitTime);
    return;
}

async function mainRoutine(){
    while(true) await retrieveActivities(3600);
}

mainRoutine();
